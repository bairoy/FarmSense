import torch
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image

# -------------------------------
# CONFIG
# -------------------------------

DEVICE = torch.device("cpu")

CLASSES = [
    "brown_spot",
    "healthy",
    "hispa",
    "leaf_blast"
]

# -------------------------------
# LOAD MODEL
# -------------------------------

model = models.resnet18(weights=None)
model.fc = torch.nn.Linear(model.fc.in_features, len(CLASSES))

model.load_state_dict(torch.load("rice_model.pth", map_location=DEVICE))
model.eval()

# -------------------------------
# TRANSFORM
# -------------------------------

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

# -------------------------------
# PREDICT
# -------------------------------

def predict_disease(image_path: str):
    image = Image.open(image_path).convert("RGB")
    image = transform(image).unsqueeze(0)

    with torch.no_grad():
        outputs = model(image)
        probs = torch.softmax(outputs, dim=1)

        confidence, pred = torch.max(probs, 1)

    return {
        "disease": CLASSES[pred.item()],
        "confidence": float(confidence.item())
    }