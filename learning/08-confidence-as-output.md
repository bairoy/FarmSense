# 08 — Confidence as a safety control, not a UI nicety

## The problem

Every number this system produces is an estimate from a simulation that has been
running unchecked since the last independent observation.

Consider two crop states, both reading **"Health: 82, irrigate 45mm"**:

- **A** — corrected against a Sentinel-2 pass yesterday, per-field soil measured
  by SoilGrids, full Penman-Monteith weather all season, farmer confirmed the
  field looked fine three days ago.
- **B** — never corrected (no CDSE credentials), district-default soil, 60% of
  days on Hargreaves fallback, no boundary polygon so satellite values come from
  a guessed box, farmer has never answered anything.

As bare numbers **they are identical.** A farmer will act on B exactly as
confidently as on A. That is the system lying, even though no individual line of
code contains a lie.

## The concept

Confidence is a **first-class output**, computed and shipped alongside every
estimate. It answers: *how much of this number came from measuring the field,
and how much came from assuming?*

Four independent degradation axes:

| Axis | Question |
|---|---|
| **Staleness** | How long has the simulation been free-running? |
| **Input quality** | Was the soil measured or defaulted? Full ETo or fallback? |
| **Spatial validity** | Real boundary, or a box around a dropped pin? |
| **Disagreement** | Did an observation contradict the model? |

## The decision

### They multiply, they don't average

```ts
let score = correctionFactor(daysSinceCorrection);
if (!soilMeasured) score *= 0.85;
score *= 0.7 + 0.3 * weatherCompleteness;
if (!hasFieldBoundary) score *= 0.88;
if (observationDisagreed) score *= 0.8;
```

Averaging would let one good factor mask three bad ones. These are **compounding
failures**: an old estimate, built on unmeasured soil, from degraded weather,
over an approximate field extent isn't "somewhat less certain" — it's barely an
estimate at all. Multiplication is the honest operator.

### Staleness decays against the satellite revisit

```ts
if (days <= 6)  return 1.0;    // within one S1C/S1D revisit cycle
if (days <= 12) return 0.9;
if (days <= 21) return 0.78;
if (days <= 30) return 0.65;
return 0.5;
```

Anchored to the 6-day constellation revisit — corrected within one cycle is as
good as this system gets. Past ~30 days, accumulated error in ETo, effective
rainfall and unlogged irrigation dominates whatever the model says.

### Disagreement *lowers* confidence

This is the counter-intuitive one. When the satellite contradicts the model we
correct toward the satellite — and then we reduce confidence anyway:

```ts
if (input.observationDisagreed) {
  score *= 0.8;
  factors.push("An independent observation disagreed with the simulation; ...");
}
```

Why not raise it? We just got new information. But a disagreement means **at
least one of the two sources was wrong and we don't know which**. Maybe the
model drifted. Maybe the NDVI pixel caught a bund. The honest response to
contradictory evidence is a wider error bar, not a narrower one.

### The output is prose, not a number

```ts
band === "very_low"
  ? "Confidence is very low. Do not act on this estimate alone - inspect the
     field, or contact your local agriculture extension officer."
```

"0.42" means nothing to a farmer. The `caveat` field is written to be shown
verbatim, and the `factors` array explains *why* it isn't higher — which is the
actionable part ("no boundary traced" is something they can fix).

### It's enforced structurally, in three places

**1. The UI pairs it with every quantity.** `RecommendationPanel` renders
`<ConfidencePanel>` before the irrigation and fertilizer cards. There's no path
that renders a volume without it.

**2. The agent leads with it.** In `ai/tools.py`, every tool result *starts* with
the confidence block:

```python
return (f"[CONFIDENCE: {band.upper()} ({score}), {staleness}]\n{caveat}\n")
```

Leading rather than trailing is deliberate: a model summarising a long tool
result reliably carries the *opening* framing into its answer, and just as
reliably drops a trailing disclaimer.

**3. The system prompt makes it a hard rule.** "If it says LOW or VERY_LOW, say
so plainly in your answer and tell the farmer to check the field themselves."

### Missing quantities are refused, not guessed

```ts
blocked: canQuantify ? null
  : "This field has no recorded area, so water and fertilizer quantities cannot
     be calculated. Add the field area (in bigha/kattha/dhur) or trace its boundary."
```

Without an area we cannot compute a quantity. Guessing one produces a confident,
specific, wrong number — strictly worse than saying we can't.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| No confidence output | A three-week-stale estimate is acted on like a fresh one. |
| Averaging the factors | One good input masks three bad ones. |
| Raising confidence on disagreement | You've declared a contradiction resolved when it isn't. |
| Numeric-only confidence | Farmers ignore it. It has to be a sentence. |
| Trailing disclaimer in the agent | The LLM drops it during summarisation. |
| Guessing a missing field area | A confident, specific, wrong fertilizer quantity. |

## Code

- `backend/src/modules/rules/confidence.ts`
- `farmsense-frontend/src/components/ConfidenceBadge.tsx`
- `ai/tools.py` — `_confidence_preamble`
- `backend/src/tests/recommendations.test.ts` — decay, disagreement, bounds
