# FarmSense AI Service

Rice leaf disease classifier (EfficientNet-B0, 10 classes, optional Grad-CAM++
heatmap) plus the agent tool layer.

Internal service — the React app never talks to it, only the Node backend does.

## Setup

```bash
cd ai
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Set AI_SERVICE_TOKEN to the same value as backend/.env
#   openssl rand -hex 32

uvicorn api:app --reload --port 8001
```

## Model weights

The model lives in `models/rice_v2/`:

| File | Committed? | What it is |
|---|---|---|
| `classes.json` | yes | Architecture, input size, normalisation and the class list. **The only source of truth for classes**: output index *i* means `classes[i]`. |
| `rice_model.pth` | no (gitignored, ~16 MB) | The weights |
| `metrics.json` | yes | Evaluation numbers from the training run |

`classes.json` and `rice_model.pth` must always be replaced **together**.

**Training happens outside this repo**, in the separate `farmsense-training`
workspace (Colab notebook). It writes all three files to its `out/` folder;
copy them into `models/rice_v2/` to deploy a new model. No code change is needed
when the class list changes, but the backend needs a treatment entry for each
new class (until it has one, the backend withholds treatment for that class).

**Hosted weights**: set `MODEL_URL` in `.env` to a public object URL and the
weights download into `models/rice_v2/` on first inference.

## Heatmap

`POST /detect-disease?heatmap=true` also returns `heatmap_b64`, a Grad-CAM++
overlay showing where in the photo the evidence for the predicted class came
from. It shows the model's attention, not whether the prediction is right. If
the highlight sits on soil or background, distrust the prediction.

## Evaluation

`models/rice_v2/metrics.json` is written by the training run and is the **only**
place an accuracy number for this project should be quoted from. It holds two
different numbers, and they must not be confused:

- `in_distribution_val`: accuracy on images like the training ones. Optimistic.
- `heldout_test`: accuracy on a whole dataset the model never saw. The honest
  estimate of how it behaves on a new camera, field or season.

Read per-class results, not just the headline:

- **Per-class recall** — overall accuracy hides "healthy is perfect, hispa is
  missed half the time", which is the failure that costs a crop.
- **Calibration** — if the model says 0.9 and is right 70% of the time, the
  confidence gate isn't protecting anyone and must be raised.
- **Gate effect** — how many predictions are withheld, and the accuracy of those
  that pass.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness probe |
| POST | `/detect-disease` | Bearer `AI_SERVICE_TOKEN` | Classify + return compressed archival JPEG. `?heatmap=true` adds `heatmap_b64` |

Auth **fails closed**: if `AI_SERVICE_TOKEN` is unset the service returns 503 to
everything rather than running wide open. A misconfigured deploy should be
obviously broken, not quietly insecure.

## Files

| File | Purpose |
|---|---|
| `api.py` | FastAPI app, service auth |
| `disease_model.py` | Architecture, lazy loading, inference |
| `image_utils.py` | EXIF-correct decode, compression for storage |
| `models/rice_v2/` | `classes.json` (committed), `rice_model.pth` (gitignored), `metrics.json` |
| `tools.py` | Agent tools — thin wrappers over backend endpoints |
| `chat_service.py` | Tool-calling loop + safety system prompt |
| `config.py` | Environment configuration |

## The rule that governs `tools.py`

**The agent never originates an agronomic number.** Fertilizer quantities come
from a published ICAR / UP Dept of Agriculture rate table × a measured field
area. Irrigation volumes
come from the FAO-56 water balance. Treatments come from a reviewed lookup gated
on classifier confidence.

An LLM asked "how much urea for my rice" produces a fluent, specific, confident
number, and a farmer cannot tell it apart from the right one. See
`learning/11-agent-grounding.md`.
