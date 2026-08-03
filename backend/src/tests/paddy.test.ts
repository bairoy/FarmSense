import test from "node:test";
import assert from "node:assert/strict";
import {
  stepPaddy,
  initialPaddyState,
  assessPaddyStress,
  paddyIrrigationRequirement,
  defaultPaddyConfig,
} from "../modules/rules/paddy.model.ts";

/**
 * Rice paddy ponded-water model.
 *
 * The point of these tests is to pin down that rice behaves DIFFERENTLY from
 * wheat. Forcing rice through the wheat depletion model was the single biggest
 * physical error in the original engine, and a test suite that passed for both
 * would mean the distinction had been lost again.
 */

test("irrigation raises the ponded water depth", () => {
  const state = stepPaddy(initialPaddyState(), 5, 0, 60);

  assert.ok(state.flooded);
  assert.ok(state.pondedDepthMm > 0);
});

test("the bund caps how much water the field can hold", () => {
  // A 300mm irrigation into a 150mm bund cannot store 300mm.
  const state = stepPaddy(initialPaddyState(), 5, 0, 300);

  assert.ok(state.pondedDepthMm <= defaultPaddyConfig.bundHeightMm);
  assert.ok(state.overflowMm > 0);
});

test("a bunded field retains rainfall rather than shedding it", () => {
  // Unlike an upland field, no runoff coefficient applies until the bund
  // overtops - retaining water is what the bund is for.
  const state = stepPaddy(initialPaddyState(), 4, 40, 0);
  assert.ok(state.pondedDepthMm > 30);
});

test("percolation and ETc drain the field over time", () => {
  let state = stepPaddy(initialPaddyState(), 5, 0, 50);
  const startDepth = state.pondedDepthMm;

  for (let day = 0; day < 5; day++) {
    state = stepPaddy(state, 5, 0, 0);
  }

  assert.ok(state.pondedDepthMm < startDepth);
});

test("percolation stops once the field is dry", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 20; day++) {
    state = stepPaddy(state, 5, 0, 0);
  }

  assert.equal(state.pondedDepthMm, 0);
  assert.equal(state.percolationMm, 0);
  assert.ok(state.dryDays > 0);
});

test("re-flooding resets the dry-day counter and soil drying", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 10; day++) state = stepPaddy(state, 5, 0, 0);

  assert.ok(state.dryDays > 0);

  state = stepPaddy(state, 5, 0, 80);

  assert.equal(state.dryDays, 0);
  assert.equal(state.soilDepletionMm, 0);
  assert.ok(state.flooded);
});

test("the soil buffer is bounded", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 100; day++) state = stepPaddy(state, 8, 0, 0);

  // Rice has shallow roots and no drought adaptation. The buffer past ponding
  // is small by design.
  assert.ok(state.soilDepletionMm <= defaultPaddyConfig.saturatedBufferMm + 0.01);
  assert.ok(Number.isFinite(state.soilDepletionMm));
});

test("a flooded field is never reported as stressed", () => {
  const state = stepPaddy(initialPaddyState(), 5, 0, 60);
  assert.equal(assessPaddyStress(state, "flowering").stressed, false);
});

test("a dry field at flowering is immediately critical", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 8; day++) state = stepPaddy(state, 5, 0, 0);

  // No tolerance here. Water deficit at anthesis causes spikelet sterility,
  // which no later action recovers.
  const stress = assessPaddyStress(state, "flowering");

  assert.equal(stress.stressed, true);
  assert.ok(stress.severity > 0.4);
  assert.match(stress.reason ?? "", /sterility/);
});

test("late-season drying is not treated as stress", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 15; day++) state = stepPaddy(state, 5, 0, 0);

  // Draining before harvest is correct practice, not a problem to flag.
  assert.equal(assessPaddyStress(state, "grain_filling").stressed, false);
  assert.equal(assessPaddyStress(state, "maturity").stressed, false);
});

test("short vegetative dry spells are tolerated (AWD is legitimate)", () => {
  let state = initialPaddyState();
  state = stepPaddy(state, 5, 0, 60);
  state = stepPaddy(state, 5, 0, 0);

  // Alternate wetting and drying is a recommended water-saving practice, so a
  // brief dry period during tillering must not fire an alarm.
  assert.equal(assessPaddyStress(state, "tillering").stressed, false);
});

test("prolonged vegetative drying does register as stress", () => {
  let state = initialPaddyState();
  for (let day = 0; day < 12; day++) state = stepPaddy(state, 6, 0, 0);

  assert.equal(assessPaddyStress(state, "tillering").stressed, true);
});

test("irrigation requirement refills to the target depth plus losses", () => {
  const state = initialPaddyState();
  const required = paddyIrrigationRequirement(state);

  // Must at least cover the target depth, plus conveyance loss.
  assert.ok(required >= defaultPaddyConfig.targetDepthMm);
});

test("a well-flooded field needs little or nothing", () => {
  const flooded = stepPaddy(initialPaddyState(), 4, 0, 60);
  const dry = initialPaddyState();

  assert.ok(paddyIrrigationRequirement(flooded) < paddyIrrigationRequirement(dry));
});

test("state stays finite and non-negative across a full season", () => {
  let state = initialPaddyState();

  for (let day = 0; day < 120; day++) {
    const rain = day % 7 === 0 ? 35 : 0;
    const irrigation = day % 21 === 0 ? 60 : 0;
    state = stepPaddy(state, 5.5, rain, irrigation);

    assert.ok(Number.isFinite(state.pondedDepthMm));
    assert.ok(state.pondedDepthMm >= 0);
    assert.ok(state.soilDepletionMm >= 0);
    assert.ok(state.pondedDepthMm <= defaultPaddyConfig.bundHeightMm + 0.01);
  }
});
