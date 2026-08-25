# 06 — Two crops, two water models

## The problem

The original engine had one state variable, `soil_moisture`, on a 0–100 scale,
used for both rice and wheat. The region config differentiated them only by
constants — a different `min_soil_moisture`, a different `critical_moisture`.

**This is physically wrong for rice, and no amount of constant-tuning fixes it.**

## The concept

### Wheat: an upland crop, and a bucket

Wheat in Gorakhpur is sown into dry soil in November and irrigated periodically.
The root zone behaves like a bucket:

- It fills from rain and irrigation
- It empties through evapotranspiration
- The crop struggles when the bucket gets too empty

The right state variable is **depletion in millimetres** — how far below field
capacity the root zone has fallen. FAO-56 chapter 8.

### Rice: a puddled paddy, and a pond

Transplanted lowland rice is completely different. The farmer:
1. Floods the field and **puddles** it — deliberately destroying soil structure
   to create a compacted, low-permeability plough pan
2. Transplants seedlings into standing water
3. Maintains a water layer for most of the vegetative and reproductive stages

In that field:

- **The soil is at or above saturation all season.** "Depletion below field
  capacity" is not a meaningful quantity. It's always zero.
- **The state variable is water depth above the soil surface**, in mm.
- **Losses are dominated by percolation through the plough pan** — a roughly
  constant mm/day rate — not by root extraction.
- **The stress trigger is the water layer disappearing**, not a gradual decline.

Look at what the two models actually track:

```ts
// Wheat — waterBalance.ts
Dr_today = Dr_yesterday + ETa − P_eff − I     // depletion, mm below FC

// Rice — paddy.model.ts
D_today  = D_yesterday + P + I − ETc − percolation    // depth, mm ABOVE surface
```

These have **opposite signs** and **different zero points**. There is no
constant you can tune that turns one into the other.

## The decision

Two separate modules, selected by config:

```json
"rice":  { "water_model": "paddy" },
"wheat": { "water_model": "depletion" }
```

```ts
const isPaddy = cropConfig.water_model === "paddy";
if (isPaddy) {
  paddy = stepPaddy(paddy, etc, rainfall, irrigation, paddyConfig);
} else {
  const step = stepWaterBalance(depletion, etc, rainfall, irrigation, capacity);
}
```

### Details that matter in the wheat model

**Ks — the stress feedback loop.** This is what makes it a model rather than a
subtraction:

```ts
const Ks = previousDepletion <= capacity.RAW
  ? 1
  : Math.max(0, (capacity.TAW - previousDepletion) / (capacity.TAW - capacity.RAW));

const ETa = etc * Ks;   // actual < potential when stressed
```

A stressed crop closes its stomata and transpires *less*, which slows further
drying. Without Ks the simulated soil hits zero far too fast and every crop
looks dead by mid-season. This is the single most important line in the wheat
model.

**Root depth grows.** A 5-day-old seedling cannot reach 1.5m of soil:

```ts
const rootDepth = currentRootDepth(cumulativeGDD, gddToFullRoot, minDepth, maxDepth);
capacity = soilCapacity(soil.tawMmPerM, rootDepth, p, etc);
```

Because `TAW = TAW_per_metre × root_depth`, treating a seedling as fully-rooted
overestimates its water access by 7×.

**Effective rainfall, not raw rainfall.** A 60mm cloudburst on clay loam does not
deliver 60mm to the root zone:

```ts
if (rainfallMm <= 25) return rainfallMm * 0.9;
if (rainfallMm <= 50) return 22.5 + (rainfallMm - 25) * 0.7;
return 40 + (rainfallMm - 50) * 0.4;
```

Counting it in full makes the model believe the field is irrigated when it is
not — precisely the wrong direction for an irrigation recommendation.

**`p` is adjusted for evaporative demand** (FAO-56 eq. 84). On a high-ETc day the
crop hits stress at a *shallower* depletion, because water cannot move to the
roots fast enough even though it's still physically in the soil.

### Details that matter in the paddy model

**No runoff coefficient.** A bunded paddy retains essentially all rainfall until
the bund overtops — that's what the bund is for. Applying the upland runoff
curve here would be wrong.

**Percolation only while flooded.** Once the field drains, percolation falls off
sharply:

```ts
const percolation = depth > 0 ? config.percolationMmPerDay : 0;
```

**Phase-aware stress, and flowering is absolute:**

```ts
if (criticalPhases.includes(phase)) {
  return { stressed: true, severity: Math.min(1, 0.4 + state.dryDays * 0.2), ... };
}
```

Water deficit at anthesis causes **spikelet sterility** — the panicle simply does
not fill, and no amount of later irrigation recovers it. One dry day here
matters more than two weeks during tillering.

**Late-season drying is NOT stress:**

```ts
if (phase === "grain_filling" || phase === "maturity") {
  return { stressed: false, severity: 0, reason: null };
}
```

The farmer drains deliberately before harvest so the soil firms up. Flagging
correct practice as a problem is how a system trains people to ignore it.

**Alternate Wetting and Drying is legitimate.** A short dry spell during
tillering is a recommended water-saving technique, not a failure. The model
tolerates up to ~5 dry days in the vegetative stage before it complains.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| One model for both crops | Rice is permanently reported as either 100% healthy or catastrophically stressed, because "depletion below field capacity" is meaningless in a flooded field. |
| No Ks feedback | Simulated soil dries to zero far too fast; every wheat crop looks dead by February. |
| Fixed root depth | Seedling water access overestimated 7×. Early-season stress completely missed. |
| Raw rainfall instead of effective | Model believes a cloudburst refilled the profile. Recommends no irrigation when irrigation is needed. |
| Flagging pre-harvest drainage as stress | Farmers learn the alerts are noise and stop reading them. |
| No phase weighting at flowering | The one moment where being right actually matters gets the same treatment as any other day. |

## Code

- `backend/src/modules/rules/waterBalance.ts` — FAO-56 bucket (wheat)
- `backend/src/modules/rules/paddy.model.ts` — ponded depth (rice)
- `backend/src/tests/waterBalance.test.ts`, `paddy.test.ts` — including
  season-long integration checks that state stays physically bounded
