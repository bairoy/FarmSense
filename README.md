# FarmSense 🌾

A crop digital twin for smallholder rice and wheat farmers in **Siraha
district, Nepal (Terai)** — built with **no field hardware and no IoT sensors**.

Crop state is inferred from weather physics, satellite imagery, farmer
check-ins, and photo diagnosis, then fused into a single estimate that always
ships with how much you should trust it.

> **Scope:** rice and wheat, Siraha only. The model is proved here before any
> expansion. Every constant is calibrated for this district.

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
   │             │      │           │     │ error bar │
   └─────────────┘      └───────────┘     └───────────┘
```

A simulation with no correction path is not a digital twin — it is a plausible
number that drifts for four months and never finds out it is wrong. The
correction loop is what couples the model to the actual field.

Full explanation: **[learning/04-predict-observe-correct.md](learning/04-predict-observe-correct.md)**

---

## What makes this different

**Physics, not heuristics.** Reference evapotranspiration is computed with
FAO-56 Penman-Monteith from real solar radiation and 2m wind. Every constant
traces to a published source — FAO-56 tables, NARC rate guidelines, ISRIC
SoilGrids measurements. Nothing is invented.

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
discriminated union so the UI physically cannot render it.

**Farmer's units.** Land is Bigha-Kattha-Dhur. Fertilizer is 50 kg sacks. Water
is pump hours.

---

## Architecture

```
farmsense-frontend/     React 19 + Vite + Tailwind
backend/                Express 5 + TypeScript (Node 24 native TS) + Supabase
ai/                     FastAPI + PyTorch (classifier) + agent tool layer
learning/               Design notes — start at 00-index.md
```

### Backend modules

| Module | Responsibility |
|---|---|
| `rules/` | FAO-56 ETo, water balance, paddy model, agronomic interpretation, confidence |
| `crop-state/` | The predict→observe→correct timeline engine |
| `satellite/` | Copernicus Sentinel-1/2 access and interpretation |
| `recommendations/` | The fused crop state + fertilizer/irrigation derivations |
| `checkin/` | Farmer-as-sensor question selection and answer interpretation |
| `disease/` | Photo → classification → R2 → `crop_states` |
| `images/` | Cloudflare R2 object storage |
| `fields/` `crops/` `irrigation/` `fertilizer/` `auth/` | CRUD and ownership |

### External data (all free tier)

| Source | Used for | Key needed |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Precipitation, temperature, **forecast** | No |
| [NASA POWER](https://power.larc.nasa.gov) | Solar radiation and 2m wind for Penman-Monteith | No |
| [ISRIC SoilGrids](https://soilgrids.org) | Per-field field capacity, wilting point, texture | No |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | Sentinel-1 SAR, Sentinel-2 optical | Free account |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Crop photos (**zero egress fees**) | Free account |

Deliberately **not** Google Earth Engine — its free tier excludes commercial and
operational use.

---

## Setup

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

Startup warns about any unconfigured integration. A missing one silently lowers
the quality of every recommendation, so it should not take reading the code to
discover it.

```bash
npm test          # 90 tests
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

### 4. Frontend

```bash
cd farmsense-frontend
npm install
npm run dev               # http://localhost:5173
```

### Verify everything is wired up

```bash
curl http://localhost:5050/api/health
```

```json
{ "status": "ok",
  "integrations": { "ai_service": true, "r2_storage": true, "copernicus_satellite": true } }
```

---

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/recommendations/:cropId` | **Everything**, derived from one fused state |
| GET | `/api/recommendations/:cropId/state` | The canonical crop state |
| GET | `/api/recommendations/:cropId/irrigation` | Dosage + forecast-aware timing |
| GET | `/api/recommendations/:cropId/fertilizer` | Rate table × field area |
| GET | `/api/crop-states/timeline/:cropId` | Full day-by-day simulation |
| POST | `/api/crop-states` | Manual state entry |
| POST | `/api/disease/crop/:cropId/analyse` | Photo → diagnosis → health history |
| GET | `/api/disease/crop/:cropId/images` | Photo history |
| POST | `/api/satellite/field/:fieldId/refresh` | Fetch a fresh Sentinel-2 pass |
| GET | `/api/satellite/crop/:cropId/transplant-detection` | Sentinel-1 V-shape detection |
| GET | `/api/checkins/crop/:cropId/due` | The question worth asking right now |
| POST | `/api/checkins/:checkinId/answer` | Record the answer |
| GET | `/api/health` | Which integrations are actually configured |

All routes require a Supabase bearer token. Ownership is enforced by joining to
`fields.user_id`.

---

## Model evaluation

Metrics live in **`ai/METRICS.md`**, generated by `ai/eval_disease_model.py` on a
held-out test split fixed by seed in `ai/dataset.py`. That file is the only place
an accuracy figure for this project should be quoted from.

It reports per-class recall and **calibration**, not just overall accuracy —
because a model that says 0.9 and is right 70% of the time makes the confidence
gate useless, and overall accuracy hides whichever class you are missing.

---

## Learning notes

Design notes explaining every significant decision, why it was made, and what
breaks if you get it wrong.

Start at **[learning/00-index.md](learning/00-index.md)**.

---

## Known limits

- **Siraha only.** Kc values, GDD boundaries and phase calendars are calibrated
  for this district. Another region needs its own `regions/*.json`.
- **Rice and wheat only.** Any other crop needs its own water model and rate table.
- **Sentinel-2 correction is unavailable during the monsoon.** Expected — that is
  what the Sentinel-1 channel is for, and confidence reflects it honestly.
- **Fertilizer doses are district defaults.** A farmer's soil test overrides them.
- **Disease treatments need review against the current PQPMC registered pesticide
  list** before any real farmer acts on them. The data file says so explicitly.
- **Unlogged irrigation degrades the water balance.** This is the single largest
  source of drift, and the main thing the farmer check-in loop exists to catch.
