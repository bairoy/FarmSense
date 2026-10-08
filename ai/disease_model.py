"""Rice leaf disease classifier (EfficientNet-B0, class list from classes.json).

The network, its input size, its normalisation and its class list all come
from `classes.json`, which the training run (farmsense-training/train.py)
writes next to the weights. None of them is hard-coded here, so retraining
with a different class set does not require touching this file - but the two
must always be deployed together, because output index i means whatever
classes.json says it means.

  * The model is loaded lazily and cached, not at import time.
  * Weights can be downloaded from MODEL_URL on first use.
  * Inference accepts a decoded image, so nothing is written to disk.
  * `heatmap=True` additionally returns a Grad-CAM++ overlay: where in the
    photo the evidence for the predicted class came from.
"""

from __future__ import annotations

import io
import threading
import urllib.request

import numpy as np
import torch
from PIL import Image
from torchvision import models, transforms

from config import CLASSES, MODEL_META, MODEL_PATH, MODEL_URL

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Must match the training run exactly - a mismatch does not raise, it silently
# costs accuracy. They come from classes.json, never from constants here.
IMG_SIZE = int(MODEL_META["img_size"])
MEAN = MODEL_META["mean"]
STD = MODEL_META["std"]

inference_transform = transforms.Compose(
    [
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ]
)

_model: torch.nn.Module | None = None
_model_lock = threading.Lock()
# Grad-CAM needs a backward pass through the shared model with hooks attached.
# One at a time, so concurrent requests cannot read each other's gradients.
_cam_lock = threading.Lock()


def build_model(num_classes: int = len(CLASSES)) -> torch.nn.Module:
    """The architecture named in classes.json, with a fresh (untrained) head."""
    arch = MODEL_META["arch"]
    if arch == "efficientnet_b0":
        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, num_classes)
        return model
    raise ValueError(f"Unsupported arch {arch!r} in classes.json")


def _ensure_weights() -> None:
    if MODEL_PATH.exists():
        return
    if not MODEL_URL:
        raise FileNotFoundError(
            f"Model weights not found at {MODEL_PATH} and MODEL_URL is unset. "
            "Copy rice_model.pth from the training run's out/ folder, or set "
            "MODEL_URL to the hosted weights (see ai/README.md)."
        )
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading model weights from {MODEL_URL} ...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)


def get_model() -> torch.nn.Module:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _ensure_weights()
                model = build_model()
                model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
                model.to(DEVICE)
                model.eval()
                _model = model
    return _model


def _jet(x: np.ndarray) -> np.ndarray:
    """Blue -> red colour ramp for values in [0, 1] (no matplotlib needed)."""
    r = np.clip(1.5 - np.abs(4 * x - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * x - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * x - 1), 0, 1)
    return np.stack([r, g, b], axis=-1)


def _overlay_jpeg(image: Image.Image, cam: np.ndarray, alpha: float = 0.45) -> bytes:
    """Blend the heatmap onto the photo (long edge capped at 512px) as a JPEG."""
    base = image.copy()
    base.thumbnail((512, 512), Image.LANCZOS)
    heat = Image.fromarray((cam * 255).astype(np.uint8)).resize(base.size, Image.BICUBIC)
    colour = _jet(np.asarray(heat, dtype=np.float32) / 255.0) * 255
    blended = np.asarray(base, dtype=np.float32) * (1 - alpha) + colour * alpha
    buffer = io.BytesIO()
    Image.fromarray(blended.astype(np.uint8)).save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def _gradcam_pp(model: torch.nn.Module, tensor: torch.Tensor) -> tuple[np.ndarray, torch.Tensor]:
    """Grad-CAM++ for the predicted class. Returns (cam in [0,1], probabilities).

    Hooks are attached for this call only and always removed, so ordinary
    predictions never pay for them and nothing leaks between requests.
    """
    layer = model.features[-1]  # last convolutional block of EfficientNet
    captured: dict[str, torch.Tensor] = {}

    forward_handle = layer.register_forward_hook(lambda m, i, o: captured.__setitem__("a", o.detach()))
    backward_handle = layer.register_full_backward_hook(
        lambda m, gi, go: captured.__setitem__("g", go[0].detach())
    )
    try:
        with _cam_lock:
            model.zero_grad()
            logits = model(tensor.clone().requires_grad_(True))
            probs = torch.softmax(logits.detach(), dim=1)[0]
            logits[0, int(probs.argmax())].backward()
    finally:
        forward_handle.remove()
        backward_handle.remove()

    acts, grads = captured["a"][0], captured["g"][0]
    g2, g3 = grads**2, grads**3
    denom = 2 * g2 + acts.sum(dim=(1, 2), keepdim=True) * g3
    alpha = g2 / torch.where(denom != 0, denom, torch.ones_like(denom))
    weights = (alpha * torch.relu(grads)).sum(dim=(1, 2))
    cam = torch.relu((weights[:, None, None] * acts).sum(0))
    cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
    return cam.cpu().numpy(), probs.cpu()


def predict_disease(image: Image.Image, heatmap: bool = False) -> dict:
    """Classify a PIL image and return the full probability distribution.

    We return every class probability, not just the winner. The margin between
    the top two classes is what tells the caller whether the model is actually
    discriminating or just guessing between two look-alike lesions, and that
    feeds the confidence gate in the recommendation layer.

    With `heatmap=True` the result also carries `heatmap_jpeg` (bytes): the
    Grad-CAM++ overlay for the predicted class.
    """
    model = get_model()
    tensor = inference_transform(image).unsqueeze(0).to(DEVICE)

    cam = None
    if heatmap:
        cam, probs = _gradcam_pp(model, tensor)
    else:
        with torch.no_grad():
            probs = torch.softmax(model(tensor), dim=1)[0].cpu()

    confidence, index = torch.max(probs, dim=0)
    probabilities = {name: round(float(probs[i]), 4) for i, name in enumerate(CLASSES)}

    ranked = sorted(probabilities.values(), reverse=True)
    margin = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]

    result = {
        "disease": CLASSES[int(index.item())],
        "confidence": round(float(confidence.item()), 4),
        "margin": round(float(margin), 4),
        "probabilities": probabilities,
    }
    if cam is not None:
        result["heatmap_jpeg"] = _overlay_jpeg(image, cam)
    return result
