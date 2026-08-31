import test from "node:test";
import assert from "node:assert/strict";
import {
  blendToward,
  applyPondedDepth,
  applyDepletionBound,
  applyHealthBounds,
  phaseAnchorOffset,
  type Phase,
} from "../modules/rules/observationCorrection.ts";

/**
 * The correct half of predict -> observe -> correct.
 *
 * These corrections are the only thing standing between a 120-day simulation
 * and a number with no connection to the field, so the properties that matter
 * are the ones that decide whether an observation is trusted too much or not at
 * all:
 *
 *   - a bound must never move the state away from an observation that agreed
 *   - confidence must scale the pull monotonically
 *   - nothing may leave the state physically impossible
 */

const PHASES: Phase[] = [
  { name: "seedling", gdd_start: 0, gdd_end: 350 },
  { name: "tillering", gdd_start: 350, gdd_end: 900 },
  { name: "flowering", gdd_start: 900, gdd_end: 1400 },
  { name: "grain_filling", gdd_start: 1400, gdd_end: 2000 },
];

// ---------------------------------------------------------------- blending

test("blending respects both endpoints", () => {
  assert.equal(blendToward(10, 50, 0), 10, "confidence 0 leaves the simulation alone");
  assert.equal(blendToward(10, 50, 1), 50, "confidence 1 takes the observation");
  assert.equal(blendToward(10, 50, 0.5), 30);
});

test("blending is monotonic in confidence", () => {
  let previous = -Infinity;
  for (let c = 0; c <= 1.0001; c += 0.1) {
    const value = blendToward(0, 100, c);
    assert.ok(value >= previous, `confidence ${c} moved less than the step before`);
    previous = value;
  }
});

test("confidence outside 0-1 is clamped rather than extrapolated", () => {
  // A stored confidence of 1.5 must not overshoot past the observation.
  assert.equal(blendToward(0, 100, 1.5), 100);
  assert.equal(blendToward(0, 100, -1), 0);
});

// ------------------------------------------------------------ ponded depth

test("a reported ponded depth pulls the simulation toward it", () => {
  // Model thinks the paddy drained; the farmer is standing in ankle-deep water.
  const result = applyPondedDepth(0, { set_ponded_depth_mm: 50, confidence: 0.9 });

  assert.equal(result.value, 45, "0 -> 50 at confidence 0.9");
  assert.equal(result.moved, 45);
  assert.match(result.note!, /Farmer reported 50 mm/);
});

test("a ponded depth that agrees with the simulation reports no movement", () => {
  const result = applyPondedDepth(50, { set_ponded_depth_mm: 50, confidence: 0.9 });
  assert.equal(result.moved, 0);
  assert.equal(result.note, null, "agreement is not a disagreement worth reporting");
});

test("ponded depth can never be driven negative", () => {
  // A drained report against an already-dry model must floor at zero, not
  // produce negative standing water.
  const result = applyPondedDepth(2, { set_ponded_depth_mm: 0, confidence: 1 });
  assert.ok(result.value >= 0, `got ${result.value}`);
});

test("a correction carrying no ponded-depth opinion is a no-op", () => {
  const result = applyPondedDepth(30, { health_score_ceiling: 55 });
  assert.equal(result.value, 30);
  assert.equal(result.moved, 0);
});

// ---------------------------------------------------------------- depletion

test("cracked soil raises an under-dry simulation to the implied floor", () => {
  // TAW 150mm, model says 30mm depleted, farmer sees cracking (>= 0.9 * TAW).
  const result = applyDepletionBound(30, 150, {
    depletion_at_least_fraction_of_TAW: 0.9,
    confidence: 0.85,
  });

  // floor = 135; 30 + (135-30)*0.85 = 119.25
  assert.ok(Math.abs(result.value - 119.25) < 0.01, `got ${result.value}`);
  assert.ok(result.moved > 0);
});

test("a lower bound never drags down a simulation that is already drier", () => {
  // This is the property that makes it a bound rather than an assignment. The
  // farmer says "at least 90%"; the model says 95%. The observation agrees, and
  // pulling the estimate DOWN to 90% would make it worse using evidence that
  // supported it.
  const result = applyDepletionBound(142, 150, {
    depletion_at_least_fraction_of_TAW: 0.9,
    confidence: 0.85,
  });

  assert.equal(result.value, 142);
  assert.equal(result.moved, 0);
});

test("an upper bound never raises a simulation that is already wetter", () => {
  const result = applyDepletionBound(20, 150, {
    depletion_at_most_fraction_of_TAW: 0.4,
    confidence: 0.7,
  });
  assert.equal(result.value, 20);
  assert.equal(result.moved, 0);
});

test("moist soil pulls an over-dried simulation back down", () => {
  // The failure this catches: the model has been free-running dry for weeks
  // because an irrigation went unlogged.
  const result = applyDepletionBound(140, 150, {
    depletion_at_most_fraction_of_TAW: 0.4,
    confidence: 0.7,
  });

  // ceiling = 60; 140 + (60-140)*0.7 = 84
  assert.ok(Math.abs(result.value - 84) < 0.01, `got ${result.value}`);
  assert.ok(result.value < 140);
});

test("corrected depletion stays inside 0..TAW", () => {
  for (const [current, fraction, confidence] of [
    [10, 1.0, 1],
    [149, 0.99, 1],
    [0, 0.0, 1],
  ] as const) {
    const result = applyDepletionBound(current, 150, {
      depletion_at_least_fraction_of_TAW: fraction,
      confidence,
    });
    assert.ok(result.value >= 0 && result.value <= 150, `got ${result.value}`);
  }
});

test("a zero-TAW soil is left alone rather than dividing by it", () => {
  const result = applyDepletionBound(20, 0, {
    depletion_at_least_fraction_of_TAW: 0.9,
  });
  assert.equal(result.value, 20);
  assert.ok(Number.isFinite(result.value));
});

// ------------------------------------------------------------------- health

test("visible stress caps an optimistic health score", () => {
  // The model sees no water or heat stress, so it says 92. The farmer is
  // looking at a yellowing field - nitrogen, pests, something the weather
  // cannot explain.
  const result = applyHealthBounds(92, { health_score_ceiling: 55, confidence: 0.85 });

  // 92 + (55-92)*0.85 = 60.55
  assert.ok(Math.abs(result.value - 60.55) < 0.01, `got ${result.value}`);
  assert.match(result.note!, /visible stress/);
});

test("a healthy report lifts a pessimistic health score", () => {
  const result = applyHealthBounds(40, { health_score_floor: 70, confidence: 0.75 });
  assert.ok(result.value > 40 && result.value <= 70, `got ${result.value}`);
});

test("a ceiling above the current score changes nothing", () => {
  const result = applyHealthBounds(50, { health_score_ceiling: 75, confidence: 0.7 });
  assert.equal(result.value, 50);
  assert.equal(result.moved, 0);
});

test("health stays within 0..100", () => {
  assert.ok(applyHealthBounds(100, { health_score_ceiling: 0, confidence: 1 }).value >= 0);
  assert.ok(applyHealthBounds(0, { health_score_floor: 100, confidence: 1 }).value <= 100);
});

// ---------------------------------------------------------------- phenology

test("confirmed flowering advances thermal time to the phase boundary", () => {
  // Model at 700 GDD (tillering); farmer sees panicles. Flowering starts at 900.
  const result = phaseAnchorOffset(700, PHASES, {
    confirm_phase: "flowering",
    confidence: 0.95,
  });

  // 0 + (200-0)*0.95 = 190
  assert.ok(Math.abs(result.value - 190) < 0.01, `got ${result.value}`);
  assert.ok(700 + result.value >= 890, "should land at or near the boundary");
});

test("confirming a phase the model already reached does not rewind it", () => {
  // The observation agrees. Discarding correctly accumulated heat would be a
  // regression dressed up as a correction.
  const result = phaseAnchorOffset(1000, PHASES, {
    confirm_phase: "flowering",
    confidence: 0.95,
  });
  assert.equal(result.value, 0);
  assert.equal(result.moved, 0);
});

test("'not yet flowering' holds a model that is running ahead", () => {
  // Model at 1000 GDD says flowering; the farmer sees no panicles.
  const result = phaseAnchorOffset(1000, PHASES, {
    phase_not_reached: "flowering",
    confidence: 0.9,
  });

  assert.ok(result.value < 0, "offset must be negative to hold thermal time back");
  assert.ok(1000 + result.value < 1000);
});

test("'not yet' for a phase the model has not claimed is a no-op", () => {
  const result = phaseAnchorOffset(500, PHASES, {
    phase_not_reached: "flowering",
    confidence: 0.9,
  });
  assert.equal(result.value, 0);
});

test("an unknown phase name is ignored rather than throwing", () => {
  // Region configs are data. A phase renamed in JSON must not take down the
  // whole timeline request.
  const result = phaseAnchorOffset(700, PHASES, {
    confirm_phase: "heading",
    confidence: 0.95,
  });
  assert.equal(result.value, 0);
});

// ------------------------------------------------------------------ general

test("a correction with no confidence still applies, conservatively", () => {
  // Older stored rows may predate the confidence field. They should not be
  // treated as certainty.
  const result = applyPondedDepth(0, { set_ponded_depth_mm: 50 });
  assert.ok(result.value > 0, "should apply something");
  assert.ok(result.value < 50, "but must not overwrite outright");
});

test("an empty correction leaves every channel untouched", () => {
  assert.equal(applyPondedDepth(30, {}).moved, 0);
  assert.equal(applyDepletionBound(30, 150, {}).moved, 0);
  assert.equal(applyHealthBounds(80, {}).moved, 0);
  assert.equal(phaseAnchorOffset(700, PHASES, {}).moved, 0);
});
