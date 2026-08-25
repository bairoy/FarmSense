# FarmSense: AI-Powered Crop Advisory for Smallholder Farmers in Eastern Uttar Pradesh

## Abstract

FarmSense is a precision agriculture platform that combines deep learning disease detection, physics-based crop modeling, and an AI chat assistant to provide actionable farming recommendations to smallholder rice and wheat farmers in the eastern Gangetic plain. The system addresses a critical gap: existing global agtech solutions are not calibrated for local land units (bigha, katha, dhur), regional cropping practices, or low-connectivity rural environments.

The deployed calibration targets **Gorakhpur district, Uttar Pradesh, India** (26.76°N, 83.37°E) — the Saryu/Rapti alluvial plain, on a kharif rice / rabi wheat rotation.

---

## 1. Problem Statement

**Who we are building for:** Smallholder farmers in Gorakhpur district, Uttar Pradesh, cultivating rice and wheat on plots typically 2-8 bigha (0.5-2 hectares).

**The problem:** These farmers face three interconnected challenges:

1. **Crop disease identification** - A rice blast outbreak misidentified as brown spot leads to wrong fungicide application, wasting money and losing yield. Extension officers at the Krishi Vigyan Kendra are understaffed relative to the number of holdings they cover.

2. **Irrigation timing** - Eastern UP has a monsoon-dependent water cycle, and the two crops in the rotation have opposite water regimes: kharif rice is grown ponded behind bunds, rabi wheat on a depleting soil-water store. Over-irrigation wastes diesel and promotes disease; under-irrigation during grain filling permanently reduces yield. Farmers rely on intuition rather than soil moisture data.

3. **Fertilizer application** - Urea is over-applied because it shows visible greening, while phosphorus, potassium and zinc deficiencies go unnoticed. Zinc deficiency (*khaira*) is endemic in Gangetic alluvium. Soil testing services exist but results take weeks.

**Why it matters:** Agriculture remains the primary livelihood for a large majority of rural households in eastern UP, and holdings here are among the smallest in India. A 10% yield loss on a 2-hectare plot can mean the difference between food security and debt for a smallholder family.

> **Note for submission:** the socio-economic figures in this section and in §7 are
> stated qualitatively on purpose. Before this report is submitted, replace them
> with cited numbers from the Agriculture Census, PLFS, or the UP Department of
> Agriculture. Do not quote a statistic you have not sourced.

---

## 2. Existing Solutions and Research Gap

| Product | Strengths | Gap for eastern UP |
|---------|-----------|--------------------|
| **Plantix** | 800 symptoms, 60 crops, 30M+ downloads | Generic recommendations; diagnosis only, no water balance; land in hectares only |
| **PlantVillage Nuru** | Offline-capable | Focus on Sub-Saharan Africa; no rice/wheat water models |
| **Farmitra.ai** | India-focused; Hindi/regional languages | Advisory content, not a per-field simulation |
| **CropIn** | Enterprise farm management | Designed for commercial farms, not smallholders |

**Our differentiation:**
- **Region-specific rule engine** - Fertilizer rates from UP Department of Agriculture / ICAR-NRRI / ICAR-IIWBR guidelines, not generic FAO tables
- **Local units throughout** - All recommendations in bigha/katha/dhur and 45/50 kg sacks, matching how farmers buy inputs
- **Two distinct water models** - A ponded paddy-depth model for kharif rice and a soil-water depletion model for rabi wheat, rather than one averaged approximation
- **Confidence-gated recommendations** - The system withholds a treatment when diagnosis confidence is below the gate, directing farmers to extension officers instead
- **Farmer-as-sensor correction loop** - Check-ins on actual crop conditions correct model drift, with confidence scores that decay when observations are stale

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
│  Field management │ Crop timeline │ Disease upload │ Chat assistant │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js + Express)                    │
│  Auth │ Fields │ Crops │ Irrigation │ Fertilizer │ Recommendations  │
│                                                                     │
│  External APIs: Open-Meteo (weather), NASA POWER (solar radiation), │
│                 SoilGrids (soil properties), Copernicus (satellite) │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       AI SERVICE (Python + FastAPI)                 │
│  Disease classifier (ResNet-18) │ LangGraph agent │ Grounded tools  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE (Supabase)                         │
│  Row-level security │ User isolation │ Crop states │ Check-ins      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Technology Choices and Rationale

| Component | Choice | Why |
|-----------|--------|-----|
| **Disease model** | ResNet-18 (transfer learning) | Small enough for CPU inference (~45MB); ImageNet pretraining transfers well to leaf images |
| **Crop modeling** | FAO-56 water balance + GDD phenology | Physics-based, interpretable, works without local training data |
| **Chat AI** | OpenAI `gpt-4o` via LangGraph ReAct agent | Grounded responses: the model cannot state agronomic numbers without calling our verified tools |
| **Database** | Supabase (Postgres + RLS) | Row-level security enforces tenant isolation at database level, not just application code |
| **Frontend** | React + TypeScript | Type safety catches data contract drift between frontend and backend |

**Region portability.** The agronomic constants — Kc curves, GDD boundaries, soil TAW, the land-unit ladder, fertilizer rates — live in `backend/src/modules/rules/regions/*.json`, selected by a `DEFAULT_REGION` environment variable and served to the frontend by `GET /api/region`. No district name is compiled into either the engine or the UI.

**Future technology roadmap:**
- **Offline mode (PWA)** - Service worker + IndexedDB for areas with intermittent connectivity
- **SMS integration** - A DLT-registered Indian gateway for check-in reminders (most farmers have feature phones)
- **Hindi language UI** - Full i18n with `react-i18next` (deliberately deferred until the functional core is complete)
- **Satellite grounding** - Sentinel-2 NDVI for the dry rabi season and Sentinel-1 SAR for the cloud-covered kharif season (integration started)

---

## 5. Technical Innovation

### 5.1 Confidence-Gated Recommendations
Unlike most disease detection apps that always provide a treatment, FarmSense implements a confidence gate:

```python
# ai/api.py
result["actionable"] = result["confidence"] >= CONFIDENCE_GATE  # default 0.65
result["confidence_gate"] = CONFIDENCE_GATE
```

The API response is a discriminated union: when `actionable` is false, the treatment field is not populated at all, so a client cannot render advice the model was unsure about.

**Documented limitation.** This gate bounds *low-confidence* errors only. A softmax over four classes has no "none of the above" output, so an image outside the training distribution is still assigned one of the four labels, often at very high confidence. Measured with the current weights: a wide paddy field photograph returns `brown_spot` at 0.97, and a solid-colour image returns `leaf_blast` at 1.00 — both above the gate. Closing this requires either a rejection class or an out-of-distribution detector; it is a known open gap, not a solved problem.

### 5.2 Multi-Source State Fusion
The `FusedCropState` object combines:
- Weather data (temperature, rainfall, humidity)
- Soil properties (texture, water-holding capacity)
- Satellite observations (when available)
- Farmer check-ins (ground truth)
- Model predictions (phenology, water balance)

All recommendation modules read from this single canonical state, ensuring the dashboard, chat agent, and irrigation advice agree.

### 5.3 Agentic AI with Tool Grounding
The chat assistant uses a strict system prompt:

> "NEVER state a fertilizer quantity, irrigation volume, pesticide name, or chemical dose from your own knowledge. Every such number must come from a tool result."

This prevents LLM hallucination of agronomic advice, a critical safety property when recommendations affect real crops. The tools additionally forward the farmer's own Supabase JWT, so row-level security applies to the agent exactly as it applies to the farmer — the agent cannot read another user's field even if prompted to.

---

## 6. Vision and Mission

**Vision:** Every smallholder farmer has access to the same quality of agronomic advice as a commercial farm with dedicated consultants.

**Mission:** Build an AI-powered advisory system that is:
- **Accurate** - Grounded in published agronomic research and physical models
- **Honest** - Reports confidence levels; refuses to guess when uncertain
- **Accessible** - Works on low-end smartphones, in Hindi, using local units
- **Affordable** - Free tier for individual farmers; sustainable through potential government/NGO partnerships

---

## 7. Social Impact and Validation

**Problem validation:**
- Uttar Pradesh has among the smallest average operational holdings in India, and eastern UP districts sit below the state average
- Rice and wheat are the dominant rotation across the eastern Gangetic plain
- Extension officer coverage per holding is low enough that most farmers do not receive an in-season field visit

*(As flagged in §1, these need cited figures before submission.)*

**Intended impact:**
- Reduce crop losses from misidentified diseases
- Optimize irrigation timing, particularly for rabi wheat where the soil-water store is the binding constraint
- Provide 24/7 advisory access in areas with limited extension coverage

**Honest limitations:**
- **The disease classifier has not been evaluated.** The training dataset is not present in the repository and no metrics file has been generated, so no accuracy figure exists for this project and none should be quoted. `ai/eval_disease_model.py` exists and will produce one once the dataset is restored.
- The classifier covers 4 rice classes only; it has no wheat classes and no "not a rice leaf" class (see §5.1)
- No field trials have been conducted with actual farmers
- The physics engine is validated against published FAO-56 worked examples, not against measured soil moisture from a Gorakhpur field
- Requires smartphone and internet; excludes farmers with feature phones only

---

## 8. Conclusion

FarmSense addresses a genuine need for localized, confidence-aware agricultural AI. While global solutions like Plantix offer broader disease coverage, they lack district-level calibration, a per-field physical simulation, and the safety mechanisms (confidence gating, tool grounding) that prevent farmers from acting on uncertain advice.

The system is functional: disease detection, irrigation recommendations, fertilizer planning, and AI chat are all implemented, with the water-balance and unit-conversion logic covered by an automated test suite. The path to impact requires evaluating the classifier against a restored dataset, field validation with actual farmers in Gorakhpur district, and expansion of the disease model to cover wheat and an out-of-distribution rejection path.

---

## References

1. FAO. (1998). *Crop evapotranspiration — Guidelines for computing crop water requirements.* FAO Irrigation and Drainage Paper 56.
2. ICAR-Indian Institute of Wheat and Barley Research. Package of practices for wheat in the North Eastern Plains Zone.
3. ICAR-National Rice Research Institute. Rice production and plant protection recommendations for eastern India.
4. Uttar Pradesh Department of Agriculture. Recommended fertilizer doses for rice and wheat.
5. Central Insecticides Board & Registration Committee (CIB&RC). Registered pesticide labels and dosages.
6. Plantix. (2024). AI-powered plant disease identification. GSMA AgriTech Programme.

---

*Project Repository: FarmSense*  
*Course: CBS1901 Technical Answers for Real World Problems (TARP)*  
*Date: August 2026*
