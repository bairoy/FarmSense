"""Central config for the FarmSense AI service.

Everything that differs between machines lives here, read from the environment
so nothing secret is ever committed.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# --- Model ---------------------------------------------------------------
# rice_model.pth is gitignored. MODEL_URL lets a clean clone fetch the exact
# weights that produced the metrics in models/rice_v2/metrics.json.
#
# The model is an EfficientNet-B0 trained in farmsense-training (Colab). Its
# files live in ai/models/rice_v2/: the weights (gitignored) and classes.json
# (committed), which the training run writes next to them.
MODEL_PATH = Path(
    os.getenv("MODEL_PATH", BASE_DIR / "models" / "rice_v2" / "rice_model.pth")
)
MODEL_URL = os.getenv("MODEL_URL")  # e.g. an R2 public object URL

# classes.json sits beside the weights. It is the ONLY source of truth for the
# class list: output index i of the network means META["classes"][i], so the
# list must travel with the weights that were trained against it.
META_PATH = MODEL_PATH.with_name("classes.json")


def _load_meta() -> dict:
    if not META_PATH.exists():
        raise FileNotFoundError(
            f"{META_PATH} not found. Copy classes.json from the training run's "
            "out/ folder next to rice_model.pth (see ai/README.md)."
        )
    meta = json.loads(META_PATH.read_text())
    missing = {"arch", "img_size", "mean", "std", "classes"} - meta.keys()
    if missing:
        raise ValueError(f"{META_PATH} is missing keys: {sorted(missing)}")
    return meta


MODEL_META = _load_meta()
CLASSES = list(MODEL_META["classes"])

# Below this softmax probability we refuse to name a treatment. See
# learning/07-confidence-gating.md for why this number is a safety control
# and not a UX preference.
CONFIDENCE_GATE = float(os.getenv("CONFIDENCE_GATE", "0.65"))

# --- Service auth --------------------------------------------------------
# The AI service is an internal microservice. Only the Node backend should be
# able to reach it, so it requires a shared secret on every inference call.
AI_SERVICE_TOKEN = os.getenv("AI_SERVICE_TOKEN")

# --- Image handling ------------------------------------------------------
# The classifier resizes to 224x224 anyway, so there is no reason to move or
# store a 4MB phone photo. See learning/04-image-pipeline-r2.md.
MAX_IMAGE_EDGE_PX = int(os.getenv("MAX_IMAGE_EDGE_PX", "1000"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "75"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(12 * 1024 * 1024)))

# --- Backend (for agent tools) ------------------------------------------
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5050")

# --- OpenAI (for LangGraph chat agent) -----------------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

