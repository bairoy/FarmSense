"""Central config for the FarmSense AI service.

Everything that differs between machines lives here, read from the environment
so nothing secret is ever committed.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

# --- Model ---------------------------------------------------------------
# rice_model.pth is gitignored (it is ~45MB). MODEL_URL lets a clean clone
# fetch the exact weights that produced the metrics in ai/METRICS.md.
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "rice_model.pth"))
MODEL_URL = os.getenv("MODEL_URL")  # e.g. an R2 public object URL

CLASSES = ["brown_spot", "healthy", "hispa", "leaf_blast"]

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
