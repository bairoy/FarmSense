# FarmSense

**A crop digital twin for smallholder rice and wheat farmers in Gorakhpur district, Uttar Pradesh, built with no field hardware and no IoT sensors.**

FarmSense simulates each field day by day from open weather, radiation and soil data. It corrects that simulation with Sentinel-1/Sentinel-2 imagery, weekly farmer check-ins and dated leaf photographs. Every recommendation is read from the resulting single crop state and ships with a confidence report.

> **Scope.** Rice and wheat, Gorakhpur district. Every agronomic constant lives in [`backend/src/modules/rules/regions/gorakhpur.json`](backend/src/modules/rules/regions/gorakhpur.json). Moving to another district means adding a region file, not editing code.

A research paper describing the design and its evaluation (rice cultivation; [`FarmSense_Research_Paper.docx`](FarmSense_Research_Paper.docx) / [`FarmSense_Research_Paper.pdf`](FarmSense_Research_Paper.pdf), LaTeX source in [`backend/experiments/paper/`](backend/experiments/paper)) is included at the repo root. The experiment scripts and raw results are in [`backend/experiments/`](backend/experiments).

---

## Features

| Area | What it does |
|---|---|
| **Crop digital twin** | Growing-degree-day phenology plus an FAO-56 water model: a soil-depletion bucket for wheat and a ponded-depth model for paddy. Every value is computed per field per day. |
| **Observation correction** | Satellite, farmer check-ins and dated photos correct the twin through one confidence-weighted operator, `x' = x + c(x_obs − x)`. |
| **Satellite grounding** | Sentinel-2 NDVI for wheat. Sentinel-1 VH backscatter detects the flooding signature to confirm rice transplant dates through the monsoon. Uses the free Copernicus Data Space Statistical API. |
| **Farmer check-ins** | A single tap-to-answer question chosen by relevance. Answers become bounds on model state, never point values. |
| **Photo diagnosis** | EfficientNet-B0 rice-leaf classifier (10 classes) behind a confidence gate, with a Grad-CAM++ heatmap of where it looked. A dated photo may lower the twin's health estimate when it disagrees with the simulation by more than 10 points. The farmer sees the before and after. |
| **Recommendations** | Irrigation dose and timing (forecast-aware) and fertilizer plan, derived from one fused state. Fertilizer quantities come from published rate tables multiplied by measured area. |
| **Chat assistant** | LangGraph ReAct agent that may state agronomic numbers only if a backend tool returned them. |
| **Farmer's units** | Area in bigha, katha and dhur. Fertilizer in 50 kg sacks. The unit ladder is region data. |
| **Field placement** | The farmer taps a point on a map. Points outside the district are rejected. |
| **Confidence as output** | Staleness, cloud contamination, fallback data and model/observation disagreement lower reported confidence. Below a threshold the app advises a field visit. |

### How the twin works

```
   PREDICT                     OBSERVE                    CORRECT
   FAO-56 ET0 + Kc      ───▶   Sentinel-1 / Sentinel-2 ─▶ pull the state toward
   + soil water model          farmer check-in            the evidence, weighted by
   (per field, per day)        dated leaf photo           the observation's confidence
```

A simulation with no correction path is a plausible number that drifts for a whole season. The correction loop is what couples the model to the field. Design notes: [`learning/04-predict-observe-correct.md`](learning/04-predict-observe-correct.md).

---

## Architecture

```
farmsense-frontend/   React 19, Vite, Tailwind, Zustand, Recharts, Leaflet
backend/              Express 5 + TypeScript (Node 24 native TS) + Supabase
ai/                   FastAPI, PyTorch classifier, LangGraph chat agent
learning/             Design notes, start at 00-index.md
docker-compose.yml    Full stack in one command
```

```
  React ──bearer JWT──▶ Express ──service token──▶ FastAPI ──▶ PyTorch / OpenAI
                          │  ▲                                     │
                          │  └──── agent tools (user's own JWT) ───┘
                          ▼
                   Supabase (Postgres + RLS)
                   Open-Meteo · NASA POWER · SoilGrids · Copernicus · S3/R2/MinIO
```

The browser talks only to the Node backend. The AI service is internal and reachable only with a shared service token.

### Backend modules

| Module | Responsibility |
|---|---|
| `rules/` | FAO-56 ET₀, water balance, paddy model, observation correction, confidence, region and treatment data files |
| `crop-state/` | The predict → observe → correct timeline engine |
| `satellite/` | Copernicus Sentinel-1/2 client and interpretation |
| `recommendations/` | Fused crop state, irrigation and fertilizer derivations |
| `checkin/` | Question selection and answer interpretation |
| `disease/` | Photo, classification, storage, twin comparison |
| `chat/` | Authenticated proxy to the AI agent |
| `images/` | S3-compatible object storage (Cloudflare R2, or bundled MinIO) |
| `region/` | Publishes the region's land-unit ladder, crops and bounds to the client |
| `fields/` `crops/` `irrigation/` `fertilizer/` `auth/` | CRUD and ownership |

### External data (all free tier)

| Source | Used for | Key |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Rainfall, temperature, humidity, forecast | none |
| [NASA POWER](https://power.larc.nasa.gov) | Solar radiation and 2 m wind | none |
| [ISRIC SoilGrids](https://soilgrids.org) | Per-field soil water properties | none |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | Sentinel-1 SAR, Sentinel-2 optical | free account |
| [OpenAI](https://platform.openai.com) | Chat language layer only, never a source of numbers | paid key |

---

## Quick start (Docker)

The whole stack starts with one command. You need Docker and a [Supabase](https://supabase.com) project.

1. **Apply the database migrations** (once):

   ```bash
   cd backend
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

2. **Create `.env` in the repository root:**

   ```bash
   SUPABASE_URL=...
   SUPABASE_PUBLISHABLE_OR_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   AI_SERVICE_TOKEN=$(openssl rand -hex 32)   # paste the generated value
   OPENAI_API_KEY=...                          # optional; enables chat
   CDSE_CLIENT_ID=...                          # optional; enables satellite correction
   CDSE_CLIENT_SECRET=...
   ```

3. **Start it:**

   ```bash
   docker compose up --build
   ```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| Backend API | http://localhost:5050/api |
| AI service | http://localhost:8000 |
| MinIO console (photo storage) | http://localhost:9003 |

Crop photos go to the bundled MinIO by default, so no cloud account is needed. To use Cloudflare R2 instead, unset `S3_ENDPOINT` and set the `R2_*` variables.

Check that the integrations are wired:

```bash
curl http://localhost:5050/api/health
# { "status": "ok", "database": true,
#   "integrations": { "ai_service": true, "r2_storage": true, "copernicus_satellite": true } }
```

## Local development

Requirements: Node 24+, Python 3.11+.

```bash
# Backend  (http://localhost:5050)
cd backend && npm install && cp .env.example .env && npm run dev

# AI service  (http://localhost:8001)
cd ai && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn api:app --reload --port 8001

# Frontend  (http://localhost:5173)
cd farmsense-frontend && npm install && cp .env.example .env && npm run dev
```

`AI_SERVICE_TOKEN` must be identical in `backend/.env` and `ai/.env`. The backend fails fast on a missing required variable and warns about each unconfigured optional integration.

Migrations in `backend/supabase/migrations/` must be applied in order. If you change the schema by hand, regenerate the types:

```bash
npx supabase gen types typescript --project-id <ref> --schema public > src/types/database.types.ts
```

---

## Configuration

**Backend** (`backend/.env` or root `.env` under Docker)

| Variable | Required | If absent |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_OR_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | yes | Server refuses to start |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | no | Photo diagnosis and chat disabled (fails closed) |
| `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | no | No satellite correction; confidence stays low |
| `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `R2_*` | no | Diagnoses recorded, photos not kept |
| `PORT`, `FRONTEND_URL`, `DEFAULT_REGION` | no | `5050`, `http://localhost:5173`, `gorakhpur` |

**AI service** (`ai/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `AI_SERVICE_TOKEN` | none | Shared secret. If unset, every request returns 503. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | none, `gpt-4o` | Chat language layer |
| `CONFIDENCE_GATE` | `0.65` | Minimum softmax probability before a treatment is named |
| `MODEL_PATH`, `MODEL_URL` | `ai/models/rice_v2/rice_model.pth` | Local weights (with `classes.json` beside them), or a URL to fetch the weights |
| `BACKEND_URL` | `http://localhost:5050` | Where the agent's tools call back |

**Frontend** (`farmsense-frontend/.env`): `VITE_API_URL`, with no trailing slash.

---

## API overview

All routes except `/api/health`, `/api/region` and `/api/auth/*` require a Supabase bearer token.

| Group | Routes |
|---|---|
| Recommendations | `GET /api/recommendations/:cropId` (+ `/state`, `/irrigation`, `/fertilizer`) |
| Twin | `GET /api/crop-states/timeline/:cropId`, `GET /api/crop-states/:cropId/current` |
| Photos | `POST /api/disease/crop/:cropId/analyse` (image + `taken_on`), `GET /api/disease/crop/:cropId/images` |
| Satellite | `GET /api/satellite/field/:fieldId/observations`, `POST …/refresh`, `GET /api/satellite/crop/:cropId/transplant-detection` |
| Check-ins | `GET /api/checkins/crop/:cropId/due`, `POST /api/checkins/:checkinId/answer` |
| Records | `/api/fields`, `/api/crops`, `/api/irrigation`, `/api/fertilizer` (create, read, update, delete) |
| Chat | `POST /api/chat` → `{ message, crop_id, history }` |
| Other | `POST /api/auth/{signup,login,refresh}`, `GET /api/region`, `GET /api/health` |

---

## Safety design

- **The agent never originates an agronomic number.** Its tools are thin wrappers over backend endpoints, and the system prompt forbids any dose, volume or quantity that a tool did not return. Background: [`learning/11-agent-grounding.md`](learning/11-agent-grounding.md).
- **Tenant isolation in two layers.** Service-layer `user_id` filters plus Postgres row-level security. The agent forwards the farmer's own token, so it cannot read another user's field.
- **Gated diagnoses.** Below the confidence gate the API response contains no treatment field at all.
- **Fail closed.** The AI service returns 503 when `AI_SERVICE_TOKEN` is unset. The satellite client raises on any error other than "no data".
- **Region validation.** Locations outside the calibrated district are rejected by the API.
- **Hardening.** Helmet headers, CORS pinned to `FRONTEND_URL`, a 1 MB JSON body cap, and rate limits (stricter on `/api/auth`, `/api/disease` and `/api/chat`).

---

## Testing

```bash
cd backend && npm test && npm run typecheck        # node:test suite
cd farmsense-frontend && npm run lint && npm run build
cd ai && pytest -v && ruff check .
```

The backend suite covers the parts where an error is costly: ET₀ against FAO-56 worked examples, water-balance invariants, bigha-katha-dhur conversion, and the correction operator. CI (`.github/workflows/ci.yml`) runs all three projects on every push and pull request. The ownership/RLS test needs a real Supabase and skips itself unless credentials and `ALLOW_REMOTE_OWNERSHIP_TESTS=1` are set.

---

## Evaluation summary

Details, methods and caveats are in the research paper. Headline results:

| Component | Result |
|---|---|
| ET₀ vs FAO-56 Uccle example | 3.88 mm/day vs 3.9 published |
| ET₀ vs Open-Meteo, full 2025–26 seasons, 3 points | r = 0.92–0.99, RMSE 0.42–0.51 mm/day |
| Wheat irrigation with shipped 1.5 m root depth | 1–2 irrigations per season vs 6 in the ICAR calendar; a 0.6 m root depth gives 3–5 |
| Farmer check-ins (simulation) | Help when irrigation is unlogged; harmful at high answer-error rates |
| Sentinel-1/2 retrieval | Works through the monsoon; 2 of 12 planned grid points completed, no ground truth |
| Confidence gate on non-leaf images | **91% accepted.** The softmax gate cannot reject out-of-distribution input. |

## Known limitations

- **Gorakhpur, rice and wheat only.** Phase boundaries and Kc values are literature defaults, not yet fitted to local ground truth.
- **The disease classifier is unevaluated.** It covers four rice classes with no accuracy figure and no "not a leaf" class, so it must be treated as decision support until a rejection mechanism and a labelled test set exist.
- **The wheat root depth of 1.5 m under-triggers irrigation** and needs local calibration before advice is relied on.
- **Check-in trust weights are fixed.** Wrong answers can degrade the estimate when irrigation is already logged.
- **Sentinel-1 transplant detection** cannot distinguish a paddy from any other persistently flooded surface.
- **Unlogged irrigation is the largest source of drift.** The check-in loop exists to catch it.
- **Disease treatments** must be reviewed against the current CIB&RC pesticide registry before a farmer acts on them.
- **No field trial has been run.** No yield or adoption claims are made.

## Documentation

Design notes explaining each significant decision are in [`learning/`](learning/00-index.md). The AI service is described in [`ai/README.md`](ai/README.md).
