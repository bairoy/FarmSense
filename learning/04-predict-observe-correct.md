# 04 — Predict → Observe → Correct: what actually makes it a "digital twin"

## The problem

The first version of the engine did this, once per day, from sowing to today:

```ts
const evap = tempMax * 0.2;        // where did 0.2 come from?
soil_moisture += 1.5;              // a flat daily gain
soil_moisture -= evap;
```

Run that for 120 days and you get a number. The number looks like soil
moisture. It is on a 0–100 scale, it goes up when it rains, it goes down when
it's hot. It will render beautifully on a dashboard.

It is also completely disconnected from the field.

There is no mechanism anywhere in that loop by which the simulation could ever
discover it was wrong. If the farmer irrigated and didn't log it, the model
never finds out. If the crop was hit by a pest, the model never finds out. If
`0.2` is the wrong coefficient for Terai clay loam, the model never finds out —
it just drifts, confidently, for four months.

**That is an open-loop simulation, not a digital twin.** The word "twin" implies
a coupling to the real thing. Without a correction path there is no coupling.

## The concept

A digital twin is a control loop:

```
                  ┌─────────────────────────────┐
                  │                             │
                  ▼                             │
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ PREDICT │───────▶│ OBSERVE │───────▶│ CORRECT │
    └─────────┘        └─────────┘        └─────────┘
     physics            independent         pull the
     from weather       evidence            model toward
                                            the evidence
```

This is the same idea as a Kalman filter, run at a much cruder resolution. You
have a process model you trust between measurements, and measurements you trust
more than the model whenever they arrive. Neither alone is enough:

- **Model without observation** drifts (the original engine).
- **Observation without model** has huge gaps — Sentinel-2 might give you 6
  usable cloud-free images across an entire monsoon season. You cannot make
  daily irrigation decisions from 6 data points.

The model interpolates between observations. The observations stop the model
from lying.

## The decision

### PREDICT — real physics, no invented constants

Every constant in the prediction step now traces to a published source:

| Quantity | Source | File |
|---|---|---|
| ETo (evaporative demand) | FAO-56 Penman-Monteith, eq. 6 | `rules/eto.ts` |
| Kc (crop coefficient) | FAO-56 Table 12 | `rules/regions/siraha.json` |
| p (depletion fraction) | FAO-56 Table 22, adjusted by eq. 84 | `rules/waterBalance.ts` |
| TAW (soil water capacity) | ISRIC SoilGrids, per field | `utils/soilgrids.service.ts` |
| Radiation, 2m wind | NASA POWER | `utils/nasapower.service.ts` |

If you cannot say where a number came from, it should not be in the model.

### OBSERVE — season-dependent, because physics doesn't care what's convenient

This is the part that surprised me most while building it. The correction
channel has to **switch by crop**, and the reason is meteorological, not
technical:

- **Wheat** grows Nov–Apr in the dry winter. Clear skies → **Sentinel-2 optical**
  works, NDVI is a real measurement of canopy vigour.
- **Rice** is transplanted into the monsoon. Weeks of unbroken cloud → optical is
  useless. **Sentinel-1 SAR** (radar) sees straight through cloud.

You cannot pick one satellite and use it for everything. See
[07-satellite-grounding.md](07-satellite-grounding.md).

And the cheapest observation channel needs no satellite at all: **there is
already a human standing in the field.** One yes/no question per week is a real
in-situ measurement, and it is more current than any satellite pass.

### CORRECT — asymmetric, partial, and it widens uncertainty

Three deliberate design choices in `applyCorrection`:

**1. The satellite wins.** If the model says "healthy" and NDVI says the canopy
is thin, we trust NDVI. The satellite is measuring the actual field; the model
is extrapolating from weather at a 10km grid resolution. Trusting the model
there is how you tell a farmer everything is fine while the crop fails.

**2. Nudge, don't overwrite.** NDVI has its own error sources — mixed pixels at
field edges, residual haze, soil background early in the season. A single
reading should move the estimate, not replace it.

```ts
// A gap under 0.10 NDVI is inside the noise of a field average.
if (Math.abs(divergence) < 0.1) return { applied: false, ... };

// 0.3 NDVI below expectation anchors the full 40-point pull.
const healthAdjustment = Math.max(-40, Math.min(15, (divergence / 0.3) * 40));
```

**3. Correct only the recent tail.** We apply the correction to the last 14
days, ramped so today gets the strongest pull:

```ts
const correctionWindow = Math.min(14, timeline.length);
for (let i = timeline.length - correctionWindow; i < timeline.length; i++) {
  const weight = (i - (timeline.length - correctionWindow) + 1) / correctionWindow;
  day.health_score = clamp(day.health_score + healthAdjustment * weight);
}
```

Why not back-propagate across the whole season? Because today's observation is
evidence about *today*. The simulation was probably fine in week 3. Rewriting
history we have no evidence about would destroy the one thing the timeline is
good for — showing when things changed.

**And critically: a correction lowers confidence.** A disagreement between model
and satellite means at least one of them is wrong and we don't know which. The
honest response is to widen the error bar, not to declare the problem solved:

```ts
observationDisagreed: correction.applied   // → confidence *= 0.8
```

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| No correction step | The model drifts silently for a whole season. Nobody notices until harvest. |
| Correction overwrites instead of nudging | One cloudy-edge NDVI reading wipes out a season of valid simulation. |
| Back-propagating corrections | The timeline becomes unreadable — you can no longer tell when a problem started. |
| Correction without lowering confidence | You've hidden a disagreement instead of surfacing it. Worst of both worlds. |
| Using one satellite for both crops | Rice gets no grounding at all — you get maybe 1 usable optical image per monsoon. |

## Code map

```
crop-state/timeline.engine.ts     the loop itself
  ├── PREDICT  rules/eto.ts, rules/waterBalance.ts, rules/paddy.model.ts
  ├── OBSERVE  satellite/*.ts, checkin/checkin.service.ts
  └── CORRECT  applyCorrection() + rules/confidence.ts
```
