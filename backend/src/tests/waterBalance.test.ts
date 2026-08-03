import test from "node:test";
import assert from "node:assert/strict";
import {
  soilCapacity,
  currentRootDepth,
  effectiveRainfall,
  stepWaterBalance,
  irrigationRequirement,
} from "../modules/rules/waterBalance.ts";

/**
 * FAO-56 soil water balance (wheat / upland crops).
 *
 * These numbers decide whether a farmer runs a diesel pump. Worth testing.
 */

test("TAW scales with root depth", () => {
  // TAW = (theta_FC - theta_WP) x Zr. 150 mm/m over 1m root zone = 150mm.
  assert.equal(soilCapacity(150, 1.0, 0.55, 5).TAW, 150);
  assert.equal(soilCapacity(150, 0.5, 0.55, 5).TAW, 75);
});

test("RAW is the depletion fraction of TAW at reference ETc", () => {
  // At ETc = 5 mm/day the eq. 84 adjustment is exactly zero, so p is unchanged.
  const capacity = soilCapacity(150, 1.0, 0.55, 5);
  assert.equal(capacity.p, 0.55);
  assert.ok(Math.abs(capacity.RAW - 82.5) < 0.01);
});

test("high evaporative demand lowers the depletion fraction", () => {
  // FAO-56 eq. 84: on a high-demand day the crop hits stress at a SHALLOWER
  // depletion, because water cannot move to the roots fast enough even though
  // it is still physically in the soil.
  const calm = soilCapacity(150, 1.0, 0.55, 2);
  const demanding = soilCapacity(150, 1.0, 0.55, 9);

  assert.ok(demanding.p < calm.p);
  assert.ok(demanding.RAW < calm.RAW);
});

test("depletion fraction stays inside the range FAO-56 declares valid", () => {
  assert.ok(soilCapacity(150, 1, 0.2, 20).p >= 0.1);
  assert.ok(soilCapacity(150, 1, 0.8, 0).p <= 0.8);
});

test("root depth grows with thermal time and then stops", () => {
  assert.equal(currentRootDepth(0, 900, 0.2, 1.5), 0.2);
  assert.equal(currentRootDepth(900, 900, 0.2, 1.5), 1.5);
  // Past full depth it must not keep growing.
  assert.equal(currentRootDepth(5000, 900, 0.2, 1.5), 1.5);

  const mid = currentRootDepth(450, 900, 0.2, 1.5);
  assert.ok(mid > 0.2 && mid < 1.5);
});

test("effective rainfall discounts heavy events", () => {
  // Small events mostly infiltrate.
  assert.ok(effectiveRainfall(10) > 8);
  // A cloudburst does not deliver its full depth to the root zone - much of it
  // runs off. Counting it in full would make the model believe a field was
  // irrigated when it was not.
  assert.ok(effectiveRainfall(100) <= 60);
  // The bigger the event, the smaller the share that infiltrates.
  assert.ok(effectiveRainfall(100) / 100 < effectiveRainfall(10) / 10);
  assert.equal(effectiveRainfall(0), 0);
  assert.equal(effectiveRainfall(-5), 0);
});

test("effective rainfall never exceeds actual rainfall", () => {
  for (const mm of [1, 5, 25, 26, 50, 51, 120]) {
    assert.ok(effectiveRainfall(mm) <= mm, `failed at ${mm}mm`);
  }
});

test("depletion increases when ETc exceeds inputs", () => {
  const capacity = soilCapacity(150, 1.0, 0.55, 5);
  const step = stepWaterBalance(20, 5, 0, 0, capacity);

  assert.equal(step.depletion, 25);
  assert.equal(step.Ks, 1); // still within RAW, so no stress feedback
});

test("depletion cannot go below zero and excess becomes deep percolation", () => {
  const capacity = soilCapacity(150, 1.0, 0.55, 5);
  const step = stepWaterBalance(10, 4, 60, 0, capacity);

  // Water beyond field capacity leaves the root zone. It is not credit
  // against tomorrow's demand.
  assert.equal(step.depletion, 0);
  assert.ok(step.deepPercolation > 0);
});

test("depletion cannot exceed TAW", () => {
  const capacity = soilCapacity(150, 1.0, 0.55, 5);
  let depletion = 140;

  for (let i = 0; i < 30; i++) {
    depletion = stepWaterBalance(depletion, 8, 0, 0, capacity).depletion;
  }

  // The crop cannot extract water that is not there.
  assert.ok(depletion <= capacity.TAW + 0.01, `got ${depletion} > TAW ${capacity.TAW}`);
});

test("Ks throttles transpiration once past RAW", () => {
  const capacity = soilCapacity(150, 1.0, 0.55, 5); // RAW 82.5, TAW 150

  const unstressed = stepWaterBalance(50, 6, 0, 0, capacity);
  const stressed = stepWaterBalance(120, 6, 0, 0, capacity);

  assert.equal(unstressed.Ks, 1);
  assert.ok(stressed.Ks < 1 && stressed.Ks > 0);

  // This feedback is what makes it a model rather than a subtraction: a
  // stressed crop closes its stomata and transpires less, which slows further
  // drying. Without it the simulated soil hits zero far too fast.
  assert.ok(stressed.ETa < unstressed.ETa);
});

test("Ks reaches zero at TAW", () => {
  const capacity = soilCapacity(150, 1.0, 0.55, 5);
  const step = stepWaterBalance(capacity.TAW, 6, 0, 0, capacity);

  assert.equal(step.Ks, 0);
  assert.equal(step.ETa, 0);
});

test("irrigation requirement accounts for application losses", () => {
  // Applying exactly the deficit leaves the field short - conveyance and
  // uneven distribution mean not all of it reaches the root zone.
  assert.ok(irrigationRequirement(50, 0.65) > 50);
  assert.equal(irrigationRequirement(0), 0);
  assert.equal(irrigationRequirement(-10), 0);
});

test("a dry season run stays physically bounded", () => {
  // Integration check: 60 days of no rain must not produce impossible values.
  const capacity = soilCapacity(150, 1.2, 0.55, 5);
  let depletion = 0;

  for (let day = 0; day < 60; day++) {
    const step = stepWaterBalance(depletion, 5.5, 0, 0, capacity);
    depletion = step.depletion;

    assert.ok(Number.isFinite(depletion));
    assert.ok(depletion >= 0 && depletion <= capacity.TAW + 0.01);
    assert.ok(step.Ks >= 0 && step.Ks <= 1);
  }
});
