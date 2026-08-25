# 10 — Recommendations that can't lie

## The problem

Fertilizer, irrigation dosage, irrigation timing and disease treatment were four
disconnected features. Each computed its own idea of crop condition from its own
inputs. The dashboard and the (planned) chat agent could disagree about the same
field on the same day, and neither would be obviously wrong — there was no
canonical answer to check against.

Worse: these features output **quantities a farmer spends money on**. A wrong
number here is not a cosmetic bug.

## The concept: one state, four views

```
                    ┌──────────────────────┐
                    │  FUSED CROP STATE    │   ← the only source of truth
                    │  health, water,      │
                    │  phase, confidence   │
                    └──────────┬───────────┘
             ┌─────────────┬───┴────┬──────────────┐
             ▼             ▼        ▼              ▼
        irrigation    fertilizer  disease      chat agent
```

Everything reads from `getFusedCropState`. The irrigation card and the
fertilizer card **cannot** disagree about whether the crop is water-stressed,
because they are looking at the same object.

## The decisions

### 1. Land units: Bigha-Katha-Dhur, not hectares

Farmers in eastern UP don't think in hectares. They think in the units written on
their khatauni. Ask for "area in acres" and you get a rough conversion
done in someone's head; ask for "2 bigha 5 katha" and you get the real number.

```
1 Bigha  = 20 Katha = 2,529.285264 m²  (≈ 0.2529 ha = 0.625 acre)
1 Katha  = 20 Dhur  =   126.4642632 m²
1 Dhur   =               6.32321316 m²
```

**Store canonically in m², convert only at the edges.** No calculation ever has
to ask which unit it's holding.

**The ladder is not hardcoded.** It is read from the active region file and
served to the frontend by `GET /api/region`, because the bigha is not one unit —
it is a family of them. The UP *pucca* bigha above is 2529 m²; the Nepal Terai
bigha this project previously used is 6772 m², 2.7× larger. A copy of the wrong
constant left behind in one file would silently misreport every field entered
through it.

These constants are exact by definition — do not "simplify" them
into rounded values. Every fertilizer quantity is `rate × area`, so a 2% area
error is a 2% chemical error across a whole field.

### 2. Fertilizer: a published table, never a language model

```ts
const rates = JSON.parse(fs.readFileSync(".../fertilizer.rates.json"));
```

Rice: **120:60:60 kg/ha** N:P₂O₅:K₂O, in three splits. Wheat: **150:60:40**.
UP Department of Agriculture / ICAR-NRRI / ICAR-IIWBR recommended doses for
eastern UP, stored as structured data — the same pattern as
`agronomic.rules.json`.

**The subtle bit that's easy to get wrong: DAP carries nitrogen.**

```ts
if (nutrients.P2O5 > 0) {
  const dapKg = nutrients.P2O5 / content.dap.P2O5;
  remainingN = Math.max(0, remainingN - dapKg * content.dap.N);   // credit it
  products.push(buildProduct("dap", dapKg, areaSqm));
}
```

DAP is 18-46-0. Applying the full urea dose *on top of* DAP over-applies
nitrogen by ~20% — the most common fertilizer arithmetic error in practice. It
costs money, increases lodging and makes blast worse. There's a test pinning
this exact number.

**Quantities are formatted in what you can buy:**

```ts
sacks >= 0.5 ? `${rounded} kg (about ${sacks.toFixed(1)} sacks of 50 kg)` : ...
```

"23.4 kg" is correct and useless at a shop selling 50 kg sacks. Below a kilo we
switch to grams, because "0.4 kg" invites a decimal error that "400 g" doesn't.

**Stress reduces nitrogen only.** A water-stressed crop can't take up nitrogen;
applying the full dose wastes it. P and K are less prone to loss and still
needed, so they're untouched.

### 3. Irrigation: dosage and timing are different questions

**Dosage** falls out of the water balance:

```ts
depth_mm = depletion / applicationEfficiency
litres   = depth_mm × areaSqm        // 1 mm over 1 m² = 1 litre
```

**Timing** cannot be answered from the water balance at all. It needs a
**forecast** — a different Open-Meteo endpoint (`api.open-meteo.com/v1/forecast`)
from the archive the rest of the system uses.

The decision rule, and the ordering matters:

```ts
// 1. Past the point where waiting is defensible — BEFORE any rain check
if (daysLeft !== null && daysLeft <= 1) {
  return { action: "irrigate_now", urgency: "critical", ... };
}

// 2. Rain arrives in time, with headroom
if (forecastTrusted && daysToRain < daysLeft) {
  const headroom = daysLeft - daysToRain;
  if (!isCriticalPhase || headroom >= 2) return { action: "wait_for_rain", ... };
}

// 3. Past RAW, no rain coming
if (depletion > RAW) return { action: "irrigate_now", ... };
```

**The `daysLeft <= 1` branch comes first on purpose.** Once the crop is at or
near critical, "wait for rain" stakes a whole season on a forecast. Forecasts are
wrong often enough that this trade is never worth it. And during flowering we
require real headroom (2+ days), not a photo finish, because being wrong there is
unrecoverable.

We also cap trust at 7 days — beyond that Open-Meteo's daily skill drops sharply.

**Pump hours, not cubic metres:**

```ts
pumpHours(litres) = litres / 10 L/s / 3600
```

A farmer with a diesel pump thinks in running time, not volume.

### 4. Disease treatment: the confidence gate

The classifier **always** returns a best guess — softmax has no "I don't know"
output. Refusing to act on a weak guess has to be an explicit decision:

```ts
if (confidence < gate) {
  return { actionable: false, reason: "...", guidance: below_gate };
}
```

Below 0.65 we return **no treatment at all** — just instructions for a better
photo and a pointer to the local extension office.

This is enforced by types on the frontend:

```ts
} & ( { actionable: true;  treatment: Treatment }
    | { actionable: false; reason: string; guidance: BelowGateGuidance } )
```

When `actionable` is false there is **no `treatment` field to render**. It is not
possible to accidentally show a chemical the backend withheld.

Why so strict: the four classes include **hispa, which is an insect**. A
confidently-wrong "leaf_blast" diagnosis sends a farmer to buy Tricyclazole for
a beetle infestation. Money spent, crop unhelped, trust gone.

### 5. Everything carries the confidence it inherited

```ts
return { state, irrigation, fertilizer, treatment,
         confidence: state.confidence,   // repeated at top level
         blocked: canQuantify ? null : "..." };
```

Repeated at the top level so a client rendering only the recommendation cards
cannot show a quantity without the caveat attached to it.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| Four features, four state calculations | Dashboard and agent contradict each other; neither is checkable. |
| Asking for hectares | Farmers guess. Every downstream quantity inherits the guess. |
| LLM generates fertilizer numbers | Fluent, confident, occasionally wrong. Farmer can't tell. |
| Not crediting DAP's nitrogen | ~20% nitrogen over-application every season. |
| Archive endpoint for timing | You cannot answer "wait for rain?" at all. |
| Checking rain before criticality | "Wait for rain", rain doesn't come, crop crosses critical at flowering. |
| No confidence gate on treatment | Fungicide recommended for an insect. |
| Gate in the API but not the types | Someone renders `result.treatment` anyway. |
| Guessing a missing field area | Confident, specific, wrong quantities. |

## Code

- `recommendations/cropState.fusion.ts` — the canonical state
- `recommendations/fertilizer.recommender.ts` + `rules/fertilizer.rates.json`
- `recommendations/irrigation.recommender.ts`
- `rules/treatments.loader.ts` + `rules/disease.treatments.json`
- `utils/landUnits.ts`
