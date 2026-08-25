# 12 — How do you test a simulation with no ground truth?

## The problem

There were no tests in the repo. The rule engine is pure, deterministic logic —
the cheapest thing in the codebase to test well, and the most consequential to
get wrong.

But there's a real difficulty: **we have no ground truth.** Nobody measured the
soil moisture in a Gorakhpur field on 14 July. We can't write
`assert(model(day) === reality)`.

So what does "correct" even mean here?

## Five kinds of test that don't need ground truth

### 1. Published worked examples — the only real anchor

FAO-56 prints intermediate values for its own equations. Those are ground truth
for the *maths*, even without ground truth for the *field*:

```ts
test("saturation vapour pressure matches FAO-56 Example 3", () => {
  assert.ok(Math.abs(saturationVapourPressure(24.5) - 3.075) < 0.005);
});

test("extraterrestrial radiation matches FAO-56 Example 8", () => {
  // 3 September (day 246) at latitude -20 deg, Ra = 32.2
  assert.ok(Math.abs(extraterrestrialRadiation(-20, 246) - 32.2) < 0.5);
});
```

**This is the highest-value test in the suite.** It's the only thing standing
between "my implementation is right" and "my implementation is
self-consistent". Four of them: FAO-56 examples 2, 3, 5 and 8.

If you implement a published model, find its worked examples. They exist
precisely so people can check implementations.

### 2. Monotonicity — direction without magnitude

You may not know that ETo is 5.8 mm/day. You absolutely know that a windy day
evaporates more than a still one:

```ts
const still = calculateEto({ ...base, windSpeed2m: 0.5 });
const windy = calculateEto({ ...base, windSpeed2m: 5.0 });
assert.ok(windy > still);
```

This test is what the old `evap = tempMax * 0.2` heuristic **could not pass** —
it had no wind input at all. Monotonicity tests catch entire missing physical
mechanisms.

Same shape for humidity (higher → lower ETo), root depth (deeper → more TAW),
evaporative demand (higher → lower depletion fraction, per eq. 84).

### 3. Physical invariants — things that must never happen

Constraints from physics, not from data:

```ts
test("depletion cannot exceed TAW", () => {
  let depletion = 140;
  for (let i = 0; i < 30; i++) depletion = stepWaterBalance(depletion, 8, 0, 0, capacity).depletion;
  assert.ok(depletion <= capacity.TAW + 0.01);
});

test("ETo is never negative", ...);
test("effective rainfall never exceeds actual rainfall", ...);
test("Ks reaches zero at TAW", ...);
```

A crop cannot extract water that isn't there. Runoff cannot be negative. These
hold regardless of location, crop or season — and they're exactly what breaks
when a sign flips during a refactor.

### 4. Long-run integration — does it stay physical for a whole season?

```ts
test("state stays finite and non-negative across a full season", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 120; day++) {
    const rain = day % 7 === 0 ? 35 : 0;
    const irrigation = day % 21 === 0 ? 60 : 0;
    state = stepPaddy(state, 5.5, rain, irrigation);

    assert.ok(Number.isFinite(state.pondedDepthMm));
    assert.ok(state.pondedDepthMm >= 0);
    assert.ok(state.pondedDepthMm <= config.bundHeightMm + 0.01);
  }
});
```

Single-step tests miss accumulating drift. A model that's fine for one day and
`NaN` by day 90 passes every unit test and fails in production.

`NaN` is the specific enemy: it propagates silently through arithmetic, throws
nothing, and surfaces as a blank chart or a `null` recommendation weeks later.

### 5. Regression tests for bugs that were actually there

Each of these encodes a real defect that existed:

```ts
test("rainfall no longer cancels water stress", () => {
  // The earlier engine set water_stress = false on ANY rainfall over 10mm,
  // regardless of deficit depth. A field 90mm short read as fine after a
  // 10mm shower.
  const result = evaluateAgronomicState({ ...base, waterStressSeverity: 0.8, rainfall: 12 });
  assert.equal(result.water_stress, true);
});

test("a permanently wet surface is not reported as a transplant", () => {
  // Without the recovery check, the V-detector calls any pond a rice crop.
});

test("DAP nitrogen is subtracted from the urea requirement", () => {
  // Ignoring DAP's 18% N over-applies nitrogen by ~20%.
  assert.ok(urea.kg < 80);
});
```

The comment explaining *what went wrong* is as valuable as the assertion.

## Testing the domain rules, not just the maths

Roughly half the suite is agronomy, not physics:

```ts
test("the same water stress costs more during flowering", ...);
test("late-season drying is not treated as stress", ...);      // draining is correct practice
test("short vegetative dry spells are tolerated (AWD is legitimate)", ...);
test("hispa is treated as an insect, not a fungus", ...);
test("a low-confidence diagnosis withholds the treatment", ...);
test("the gate boundary is inclusive", ...);
```

These encode domain knowledge that would otherwise live only in someone's head.
`"late-season drying is not treated as stress"` documents *why* the code has a
branch that looks like a missing check.

## When a test fails, work out who's wrong

Two of my tests failed on first run. Both times **the test was wrong, not the
code**:

1. I asserted `disease_risk === 0` above 35°C. The code returns `0.3` — the
   `humidity > 70` background branch. The code was right; I'd forgotten my own
   fallthrough. The test now asserts the actual intended behaviour *and*
   documents why (fungal window is 25–35°C).

2. I asserted `effectiveRainfall(100) < 60`. It's exactly 60. Off-by-one on a
   boundary I wrote myself. Replaced with a boundary-safe check *plus* a
   monotonicity assertion that's more meaningful anyway.

A red test means one of the two is wrong. Check which before changing anything.

## Result

**90 tests, all passing**, across `eto`, `waterBalance`, `paddy`, `landUnits`,
`agronomic` and `recommendations`. No mocking framework, no test runner
dependency — `node --test` and `node:assert/strict`, because the logic under
test is pure by design.

```bash
cd backend
npm test          # node --test "src/tests/**/*.test.ts"
npm run typecheck # tsc --noEmit
```

## The general lesson

You can test a physical model rigorously without ground truth, by testing:

- against **published worked examples** (the only true anchor — find them)
- **direction** rather than magnitude (monotonicity)
- **invariants** that physics forbids from being violated
- **long runs** for drift and `NaN`
- **past bugs**, so they stay dead

What you cannot test this way is whether the model matches the actual field.
That's what the observe/correct loop is for — and why every output ships with a
confidence value.
