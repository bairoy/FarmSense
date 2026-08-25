# FarmSense 🌾

A crop digital twin for smallholder rice and wheat farmers in **Gorakhpur
district, Uttar Pradesh** — built with **no field hardware and no IoT sensors**.

Crop state is inferred from weather physics, satellite imagery, farmer check-ins
and photo diagnosis, then fused into a single estimate that always ships with how
much you should trust it.

> **Scope:** rice and wheat, Gorakhpur only. The model is proved here before any
> expansion. Every constant is calibrated for this district and lives in
> `backend/src/modules/rules/regions/gorakhpur.json` — moving districts means
> adding a file, not editing code.

---

## The core idea: predict → observe → correct

```
              ┌─────────────────────────────────┐
              │                                 │
              ▼                                 │
   ┌─────────────┐      ┌───────────┐     ┌───────────┐
   │   PREDICT   │─────▶│  OBSERVE  │────▶│  CORRECT  │
   │             │      │           │     │           │
   │ FAO-56 ETo  │      │ Sentinel-2│     │ pull model│
   │ + Kc + soil │      │ Sentinel-1│     │ toward the│
   │ water model │      │ farmer    │     │ evidence, │
   │             │      │ photo     │     │ widen the │
   │             │      │ check-in  │     │ error bar │
   └─────────────┘      └───────────┘     └───────────┘
```

A simulation with no correction path is not a digital twin — it is a plausible
number that drifts for four months and never finds out it is wrong. The
correction loop is what couples the model to the actual field.

Full explanation: **[learning/04-predict-observe-correct.md](learning/04-predict-observe-correct.md)**

---

## What makes this different

**Physics, not heuristics.** Reference evapotranspiration is computed with FAO-56
Penman-Monteith from real solar radiation and 2m wind. Every constant traces to a
published source — FAO-56 tables, ICAR and UP Department of Agriculture rate
guidelines, ISRIC SoilGrids measurements. Nothing is invented.

**Rice and wheat get genuinely different models.** Wheat uses a soil-water
depletion bucket. Rice uses a ponded-water-depth model — because a puddled paddy
is saturated all season and "depletion below field capacity" is a meaningless
quantity there. The two have opposite signs and different zero points; no amount
of constant tuning turns one into the other.

**Season-appropriate satellite grounding.** Wheat grows in the dry winter →
Sentinel-2 optical NDVI works. Rice is transplanted into the monsoon → optical is
blind for weeks, so Sentinel-1 **radar** detects the V-shaped flooding signature
to confirm the actual transplant date.

**The farmer is a sensor.** One yes/no question a week is a free, real, in-situ
observation — and more current than any satellite pass.

**Confidence is a safety control.** Every recommendation carries its staleness,
input quality, and any model/observation disagreement. A three-week-stale
estimate must not look identical to a fresh one.

**Recommendations cannot lie.** Quantities come from published rate tables ×
measured field area, never from a language model. Below a confidence threshold
the disease classifier's treatment is **withheld entirely** — enforced by a
discriminated union so the UI physically cannot render it. (The gate's real
limits are documented honestly under
[Model evaluation](#what-the-confidence-gate-does-and-does-not-protect-against).)

**The chat agent explains, it never originates.** The LangGraph assistant answers
in plain language, but every number it says comes back from a backend tool call
(see [The grounding rule](#the-grounding-rule)).

**Farmer's units.** Land is Bigha-Katha-Dhur, as written on the khatauni.
Fertilizer is 50 kg sacks. Water is pump hours. The unit ladder is region data,
not code — a bigha is 2529 m² in Gorakhpur and 6772 m² in the Nepal Terai, and
that difference is a 2.7× error in every dose if it is hardcoded anywhere.

---

## Architecture

```
farmsense-frontend/   React 19 + Vite 7 + Tailwind 4 + Zustand + Recharts
backend/              Express 5 + TypeScript (Node 24 native TS) + Supabase
ai/                   FastAPI + PyTorch classifier + LangGraph chat agent
learning/             Design notes — start at 00-index.md
docker-compose.yml    All three services, one command
.github/workflows/    CI: typecheck, test, lint, build for all three
```

Request flow — the React app only ever talks to the Node backend; the AI service
is internal and reachable only with a shared service token:

```
  React ──bearer JWT──▶ Express ──service token──▶ FastAPI ──▶ PyTorch / OpenAI
                          │  ▲                                     │
                          │  └───── agent tools (user's own JWT) ──┘
                          ▼
                   Supabase (Postgres + RLS)
                   Open-Meteo · NASA POWER · SoilGrids · Copernicus · R2
```

### Backend modules

| Module | Responsibility |
|---|---|
| `rules/` | FAO-56 ETo, water balance, paddy model, agronomic interpretation, confidence, region + treatment data files |
| `region/` | Publishes the active region's land-unit ladder and crop list to the client |
| `crop-state/` | The predict→observe→correct timeline engine |
| `satellite/` | Copernicus Sentinel-1/2 access and interpretation |
| `recommendations/` | The fused crop state + fertilizer/irrigation derivations |
| `checkin/` | Farmer-as-sensor question selection and answer interpretation |
| `disease/` | Photo → classification → R2 → `crop_states` |
| `chat/` | Thin authenticated proxy to the AI service's agent |
| `images/` | Cloudflare R2 object storage |
| `fields/` `crops/` `irrigation/` `fertilizer/` `auth/` | CRUD and ownership |

### AI service

| File | Purpose |
|---|---|
| `api.py` | FastAPI app, service-token auth, `/health` `/detect-disease` `/chat` |
| `disease_model.py` | ResNet-18, 4 classes, lazy weight loading, inference |
| `train_rice_model.py` / `eval_disease_model.py` | Transfer learning; generates `METRICS.md` |
| `dataset.py` | The seed-fixed train/val/test split, shared by training and eval |
| `image_utils.py` | EXIF-correct decode, compression for archival storage |
| `langgraph_agent.py` | ReAct tool-calling graph, safety system prompt, ≤6 tool rounds |
| `tools.py` | Agent tools — thin wrappers over backend endpoints |

### Database

Ten tables in Supabase Postgres: `users`, `fields`, `crop_instances`,
`crop_states`, `crop_images`, `irrigation_actions`, `fertilizer_actions`,
`satellite_observations`, `farmer_checkins`, `orphaned_rows`.

Migrations are in `backend/supabase/migrations/` and must be applied **in
order** — `row_level_security.sql` depends on `ownership_not_null.sql` having
already run, or rows orphaned by a NULL predicate become invisible.

### External data (all free tier)

| Source | Used for | Key needed |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Precipitation, temperature, **forecast** | No |
| [NASA POWER](https://power.larc.nasa.gov) | Solar radiation and 2m wind for Penman-Monteith | No |
| [ISRIC SoilGrids](https://soilgrids.org) | Per-field field capacity, wilting point, texture | No |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | Sentinel-1 SAR, Sentinel-2 optical | Free account |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Crop photos (**zero egress fees**) | Free account |
| [OpenAI](https://platform.openai.com) | Chat agent language layer only — never a source of numbers | Paid key |

Deliberately **not** Google Earth Engine — its free tier excludes commercial and
operational use.

---

## Setup

**Prerequisites:** Node 24+ (the backend runs TypeScript natively, no build
step), Python 3.11+, a Supabase project.

### 1. Database

```bash
cd backend
npx supabase login          # once
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations are additive and idempotent — safe to run on an existing
database, including one whose tables were created by hand in the dashboard.

Verify they landed:

```bash
node --input-type=module -e "
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (const [t,c] of [['fields','area_sqm'],['fields','boundary'],['crop_states','source'],
                     ['crop_images','r2_key'],['satellite_observations','ndvi'],
                     ['farmer_checkins','question_key']]) {
  const { error } = await s.from(t).select(c).limit(1);
  console.log((error ? 'MISSING ' : 'present ') + t + '.' + c);
}"
```

**If you change the schema by hand in the dashboard, regenerate the types** —
otherwise the code compiles against a schema that no longer exists:

```bash
npx supabase gen types typescript --project-id <ref> --schema public \
  > src/types/database.types.ts
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # Supabase keys + AI_SERVICE_TOKEN
npm run dev               # http://localhost:5050
```

Startup fails fast on a missing **required** variable and warns about any
unconfigured **optional** integration. A missing one silently lowers the quality
of every recommendation, so it should not take reading the code to discover it.

```bash
npm test          # 100 passing, 1 skipped
npm run typecheck
```

### 3. AI service

```bash
cd ai
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # AI_SERVICE_TOKEN must match backend/.env
uvicorn api:app --reload --port 8001
```

Model weights: run `python train_rice_model.py` then `python eval_disease_model.py`,
or set `MODEL_URL` to hosted weights. See [ai/README.md](ai/README.md).

Chat needs `OPENAI_API_KEY`; without it the classifier still works and `/chat`
reports itself unavailable.

### 4. Frontend

```bash
cd farmsense-frontend
npm install
cp .env.example .env      # VITE_API_URL
npm run dev               # http://localhost:5173
```

### Verify everything is wired up

```bash
curl http://localhost:5050/api/health
```

```json
{ "status": "ok",
  "database": true,
  "integrations": { "ai_service": true, "r2_storage": true, "copernicus_satellite": true } }
```

### Docker

All three services, with an `.env` at the repo root supplying the same keys:

```bash
docker compose up --build
# frontend :3000   backend :5050   ai :8000
```

Two caveats: `docker-compose.yml` is not committed yet, and it passes
`R2_BUCKET_NAME` while `config/env.ts` reads `R2_BUCKET` — so under Docker, R2
silently falls back to the default bucket name. Local `npm run dev` is the
verified path; the compose stack has not been run end to end.

---

## Configuration

`backend/.env`

| Variable | Required | Effect if absent |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_OR_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **yes** | Server refuses to boot |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | no | Disease detection and chat disabled (fail closed) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` | no | Diagnoses recorded, photos not kept |
| `CDSE_CLIENT_ID`, `CDSE_CLIENT_SECRET` | no | **No satellite correction** — confidence stays low, honestly |
| `PORT`, `FRONTEND_URL`, `DEFAULT_REGION` | no | Default to `5050`, `localhost:5173`, `gorakhpur` |

`ai/.env`

| Variable | Default | Purpose |
|---|---|---|
| `AI_SERVICE_TOKEN` | — | Shared secret; must equal the backend's. Unset ⇒ 503 to everything |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | `gpt-4o` | Chat agent language layer |
| `CONFIDENCE_GATE` | `0.65` | Below this softmax probability no treatment is named |
| `MODEL_PATH`, `MODEL_URL` | `rice_model.pth` | Local weights, or a URL to fetch them on first inference |
| `MAX_IMAGE_EDGE_PX`, `JPEG_QUALITY`, `MAX_UPLOAD_BYTES` | `1000`, `75`, 12 MB | Archival compression limits |
| `BACKEND_URL` | `http://localhost:5050` | Where the agent tool layer calls back to |

`farmsense-frontend/.env` — `VITE_API_URL` (no trailing slash).

---

## API

All routes except `/api/health` and `/api/auth/*` require a Supabase bearer
token. Ownership is enforced twice: by `.eq("user_id", …)` in the service layer
and by row-level security in Postgres.

**Recommendations** — the surface the app actually reads from

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/recommendations/:cropId` | **Everything**, derived from one fused state |
| GET | `/api/recommendations/:cropId/state` | The canonical crop state |
| GET | `/api/recommendations/:cropId/irrigation` | Dosage + forecast-aware timing |
| GET | `/api/recommendations/:cropId/fertilizer` | Rate table × field area |

**Crop state and the twin**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/crop-states/timeline/:cropId` | Full day-by-day simulation |
| GET | `/api/crop-states/:cropId/current` | Latest state only |
| GET | `/api/crop-states/:cropId` | State history |
| POST | `/api/crop-states` | Manual state entry |
| DELETE | `/api/crop-states/state/:stateId` | Remove a state |

**Observation channels**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/disease/crop/:cropId/analyse` | Photo → diagnosis → health history |
| GET | `/api/disease/crop/:cropId/images` | Photo history |
| GET | `/api/satellite/field/:fieldId/observations` | Stored passes |
| POST | `/api/satellite/field/:fieldId/refresh` | Fetch a fresh Sentinel-2 pass |
| GET | `/api/satellite/crop/:cropId/transplant-detection` | Sentinel-1 V-shape detection |
| GET | `/api/checkins/crop/:cropId/due` | The question worth asking right now |
| GET | `/api/checkins/crop/:cropId/history` | Past answers |
| POST | `/api/checkins/:checkinId/answer` | Record the answer |

**Records and CRUD**

| Method | Path | Purpose |
|---|---|---|
| POST/GET/PUT/DELETE | `/api/fields`, `/api/fields/:fieldId` | Fields (area in the region's customary units, optional boundary) |
| POST | `/api/crops` · GET `/api/crops/field/:fieldId` · GET/PUT/DELETE `/api/crops/:cropId` | Crop instances |
| POST | `/api/irrigation` · GET `/api/irrigation/:cropId` · DELETE `/api/irrigation/:irrigationId` | Irrigation log |
| POST | `/api/fertilizer` · GET `/api/fertilizer/:cropId` · DELETE `/api/fertilizer/:fertilizerId` | Fertilizer log |

**Other**

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/signup` · `/api/auth/login` · `/api/auth/refresh` | Auth |
| GET | `/api/region` | Active region: land-unit ladder + crop list (public) |
| POST | `/api/chat` | `{ message, crop_id, history }` → agent reply |
| GET | `/api/health` | Which integrations are actually configured |

Internal AI service (service token only, never exposed to the browser):
`GET /health`, `POST /detect-disease`, `POST /chat`.

---

## The grounding rule

> **The agent never originates an agronomic number.**

Every tool in `ai/tools.py` is a thin wrapper over a backend endpoint.
Fertilizer quantities come from a published ICAR / UP Department of Agriculture
rate table × a measured field area. Irrigation volumes come from the FAO-56 water balance. Treatments come
from a reviewed lookup gated on classifier confidence. Tool results are prefixed
with a `CONFIDENCE` line the model is instructed to carry through verbatim.

The tools forward **the farmer's own Supabase token**, not a service key — so the
backend's ownership checks and RLS apply unchanged, and the agent cannot read a
crop its user does not own even if it is asked to.

An LLM asked "how much urea for my rice" produces a fluent, specific, confident
number, and a farmer cannot tell it apart from the right one. See
[learning/11-agent-grounding.md](learning/11-agent-grounding.md).

---

## Security

- **Two layers of tenant isolation.** Service-layer `user_id` filters *and*
  Postgres RLS policies. A dropped policy does not silently open the database; a
  missed filter does not silently leak it.
- **The AI service fails closed.** With `AI_SERVICE_TOKEN` unset it returns 503
  to everything rather than running wide open — a misconfigured deploy should be
  obviously broken, not quietly insecure.
- **Rate limiting.** A general limiter on every route, a stricter one on
  `/api/auth`, and a per-user limiter on the expensive routes (`/api/disease`,
  `/api/chat`).
- **Helmet** security headers, CORS pinned to `FRONTEND_URL`, 1 MB JSON body cap.

---

## Testing and CI

```bash
cd backend && npm test        # 100 passing, 1 skipped (node:test)
cd backend && npm run typecheck
cd farmsense-frontend && npm run lint && npm run build
cd ai && pytest -v && ruff check .
```

The backend suite tests the parts where being wrong is expensive: ETo against
FAO-56 worked examples, water-balance and paddy invariants (depletion bounded by
TAW, Ks throttling past RAW, excess becoming deep percolation), Bigha-Katha-Dhur
conversions, and rejection of crops the region has no calibration for. See
[learning/12-testing-a-physical-model.md](learning/12-testing-a-physical-model.md).

**The ownership/RLS test is the skipped one.** It needs a real Supabase to prove
anything, so it self-skips unless credentials are exported and — against a
remote project — `ALLOW_REMOTE_OWNERSHIP_TESTS=1` is set. Tenant isolation is
therefore *implemented* but not *demonstrated* by a default `npm test` run:

```bash
SUPABASE_URL=... SUPABASE_PUBLISHABLE_OR_ANON_KEY=... \
SUPABASE_SERVICE_ROLE_KEY=... ALLOW_REMOTE_OWNERSHIP_TESTS=1 npm test
```

`.github/workflows/ci.yml` defines three jobs (backend, frontend, AI) for every
push and PR to `main`. Backend linting is skipped on purpose: typescript-eslint
does not support TS 7 yet.

**Current CI status: not yet green, and not yet committed.** The workflow file is
still untracked, so it has never run. As written, two of the three jobs would
fail today:

| Job | State | Why |
|---|---|---|
| Backend | would pass | typecheck and tests are clean |
| Frontend | would fail | `npm run lint` reports 10 errors (mostly `no-explicit-any` in `catch` blocks) |
| AI | would fail | `pytest` is in the workflow but `ai/` contains no tests, and pytest exits non-zero when it collects none |

---

## Model evaluation

> **The classifier is currently unevaluated. There is no accuracy figure for this
> project, and none should be quoted anywhere.**

`ai/eval_disease_model.py` is written and would generate `ai/METRICS.md` on a
held-out test split fixed by seed in `ai/dataset.py`. It has not been run against
the committed weights, `ai/METRICS.md` does not exist, and `ai/data/` is absent —
so the evaluation cannot currently be reproduced without re-acquiring the
dataset. What exists is a trained ResNet-18 with a 4-class head that loads and
performs inference; how well it does so is unmeasured.

When it is run, it reports per-class recall, **calibration**, and the gate's
effect — not just overall accuracy — because a model that says 0.9 and is right
70% of the time makes the confidence gate useless, and overall accuracy hides
whichever class you are missing.

### What the confidence gate does and does not protect against

The gate is a softmax threshold over four in-distribution classes. It correctly
withholds a treatment when the model is torn *between those four*. It does
nothing about inputs the model was never trained on, because softmax over four
classes has no way to express "none of these". Reproducible today:

| Input | Predicted | Confidence | Gate outcome |
|---|---|---|---|
| A wide paddy field photo, not a leaf | `brown_spot` | 0.97 | passes — treatment shown |
| A solid red rectangle | `leaf_blast` | 1.00 | passes — treatment shown |
| Pure noise | `leaf_blast` | 1.00 | passes — treatment shown |

An out-of-distribution reject path is required before any farmer uses photo
diagnosis. This is a known gap, not a discovered surprise.

---

## Learning notes

Design notes explaining every significant decision, why it was made, and what
breaks if you get it wrong.

Start at **[learning/00-index.md](learning/00-index.md)**.

---

## Known limits

- **Gorakhpur only.** Kc values, GDD boundaries, phase calendars and the land-unit
  ladder are calibrated for this district. Another region needs its own
  `regions/*.json` — including its own bigha, which is not a constant across UP.
- **Phase boundaries are literature defaults.** They were carried over from the
  earlier Terai calibration and adjusted for Purvanchal sowing dates. They have
  not yet been fitted against a season of local ground truth.
- **Rice and wheat only.** Any other crop needs its own water model and rate table.
- **Sentinel-2 correction is unavailable during the monsoon.** Expected — that is
  what the Sentinel-1 channel is for, and confidence reflects it honestly.
- **Fertilizer doses are district defaults.** A farmer's soil test overrides them.
- **Disease treatments need review against the current CIB&RC registered pesticide
  list** before any real farmer acts on them. The data file says so explicitly.
- **The classifier covers rice leaves only** — four classes, with no "not a rice
  leaf" class and no accuracy measurement. It has nothing to say about wheat, and
  it will confidently classify a photo of anything at all.
- **Unlogged irrigation degrades the water balance.** This is the single largest
  source of drift, and the main thing the farmer check-in loop exists to catch.
