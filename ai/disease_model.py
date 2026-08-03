"""Rice leaf disease classifier (ResNet-18, 4 classes).

Changes from the first version:
  * The model is loaded lazily and cached, not at import time. Importing a
    module should not blow up because a weights file is missing.
  * Weights can be downloaded from MODEL_URL on first use, so a clean clone is
    reproducible without committing a 45MB binary.
  * Inference accepts bytes, not a filesystem path, so nothing has to be
    written to disk to be classified.
  * Normalisation now matches the ImageNet statistics used during training.
"""

from __future__ import annotations

import threading
import urllib.request

import torch
import torchvision.transforms as transforms
from PIL import Image
from torchvision import models

from config import CLASSES, MODEL_PATH, MODEL_URL

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ImageNet statistics. These must match train_rice_model.py exactly — a
# mismatch here does not raise, it just silently costs several points of
# accuracy, which is the worst kind of bug for a model you cannot see inside.
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

inference_transform = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ]
)

_model: torch.nn.Module | None = None
_model_lock = threading.Lock()


def build_model(num_classes: int = len(CLASSES)) -> torch.nn.Module:
    """The architecture, defined once and shared by training and inference."""
    model = models.resnet18(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, num_classes)
    return model


def _ensure_weights() -> None:
    if MODEL_PATH.exists():
        return
    if not MODEL_URL:
        raise FileNotFoundError(
            f"Model weights not found at {MODEL_PATH} and MODEL_URL is unset. "
            "Either train them with `python ai/train_rice_model.py` or set "
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


def predict_disease(image: Image.Image) -> dict:
    """Classify a PIL image and return the full probability distribution.

    We return every class probability, not just the winner. The margin between
    the top two classes is what tells the caller whether the model is actually
    discriminating or just guessing between two look-alike lesions, and that
    feeds the confidence gate in the recommendation layer.
    """
    model = get_model()
    tensor = inference_transform(image).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    confidence, index = torch.max(probs, dim=0)
    probabilities = {name: round(float(probs[i]), 4) for i, name in enumerate(CLASSES)}

    ranked = sorted(probabilities.values(), reverse=True)
    margin = ranked[0] - ranked[1] if len(ranked) > 1 else ranked[0]

    return {
        "disease": CLASSES[int(index.item())],
        "confidence": round(float(confidence.item()), 4),
        "margin": round(float(margin), 4),
        "probabilities": probabilities,
    }
