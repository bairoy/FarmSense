import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAgronomicState } from "../modules/rules/agronomic.engine.ts";

const riceConfig = {
  max_temperature_threshold_c: 35,
  critical_flowering_temp_c: 33,
};

const base = {
  crop: "rice",
  phase: "tillering",
  waterStressSeverity: 0,
  waterStressReason: null,
  tempMax: 30,
  humidity: 50,
  rainfall: 0,
  isPaddy: true,
  cropConfig: riceConfig,
};

test("a healthy crop scores 100", () => {
  const result = evaluateAgronomicState(base);

  assert.equal(result.health_score, 100);
  assert.equal(result.status, "healthy");
  assert.equal(result.water_stress, false);
  assert.equal(result.heat_stress, false);
});

test("water stress lowers health proportionally to severity", () => {
  const mild = evaluateAgronomicState({ ...base, waterStressSeverity: 0.2 });
  const severe = evaluateAgronomicState({ ...base, waterStressSeverity: 0.9 });

  assert.equal(mild.water_stress, true);
  assert.ok(severe.health_score < mild.health_score);
});

test("the same water stress costs more during flowering", () => {
  // A crop compensates for lost vegetative growth. It cannot recover a sterile
  // panicle, so the penalty has to be phase-aware.
  const vegetative = evaluateAgronomicState({
    ...base,
    phase: "tillering",
    waterStressSeverity: 0.5,
  });
  const flowering = evaluateAgronomicState({
    ...base,
    phase: "flowering",
    waterStressSeverity: 0.5,
  });

  assert.ok(flowering.health_score < vegetative.health_score);
  assert.match(flowering.recommendations.join(" "), /cannot be recovered/);
});

test("rainfall no longer cancels water stress", () => {
  // Regression test. The earlier engine set `water_stress = false` on any
  // rainfall over 10mm, regardless of how deep the deficit was - so a field
  // 90mm short would be reported as fine after a 10mm shower.
  const result = evaluateAgronomicState({
    ...base,
    waterStressSeverity: 0.8,
    waterStressReason: "deep deficit",
    rainfall: 12,
  });

  assert.equal(result.water_stress, true);
  assert.ok(result.health_score < 100);
});

test("heat stress triggers above the crop threshold", () => {
  const result = evaluateAgronomicState({ ...base, tempMax: 39 });

  assert.equal(result.heat_stress, true);
  assert.ok(result.health_score < 100);
});

test("flowering uses the lower heat threshold", () => {
  // 34C is fine for a tillering rice plant and damaging at anthesis.
  const vegetative = evaluateAgronomicState({ ...base, phase: "tillering", tempMax: 34 });
  const flowering = evaluateAgronomicState({ ...base, phase: "flowering", tempMax: 34 });

  assert.equal(vegetative.heat_stress, false);
  assert.equal(flowering.heat_stress, true);
});

test("paddy heat advice recommends raising the water layer", () => {
  const result = evaluateAgronomicState({ ...base, tempMax: 40, isPaddy: true });
  assert.match(result.recommendations.join(" "), /water depth/i);
});

test("upland heat advice does not mention standing water", () => {
  const result = evaluateAgronomicState({
    ...base,
    crop: "wheat",
    isPaddy: false,
    tempMax: 40,
    cropConfig: { max_temperature_threshold_c: 32, critical_flowering_temp_c: 30 },
  });

  assert.doesNotMatch(result.recommendations.join(" "), /standing water/i);
});

test("disease risk rises with humidity and rain", () => {
  const humid = evaluateAgronomicState({ ...base, humidity: 85, tempMax: 30 });
  const humidAndWet = evaluateAgronomicState({
    ...base,
    humidity: 85,
    tempMax: 30,
    rainfall: 5,
  });

  assert.equal(humid.disease_risk, 0.6);
  assert.equal(humidAndWet.disease_risk, 0.8);
});

test("disease risk advice asks for a photo rather than a spray", () => {
  // This is an environmental proxy, not a diagnosis. It should raise
  // vigilance, never trigger a chemical application on its own.
  const result = evaluateAgronomicState({
    ...base,
    humidity: 88,
    tempMax: 30,
    rainfall: 5,
  });

  assert.match(result.recommendations.join(" "), /photograph|inspect/i);
});

test("above the fungal temperature window, disease risk drops back", () => {
  const inWindow = evaluateAgronomicState({ ...base, humidity: 85, tempMax: 30 });
  const tooHot = evaluateAgronomicState({ ...base, humidity: 85, tempMax: 38 });

  // Blast and brown spot need 25-35C. Above that the fungal window closes, so
  // humidity alone leaves only a background risk - the crop's problem at 38C
  // is heat, not fungus.
  assert.equal(inWindow.disease_risk, 0.6);
  assert.equal(tooHot.disease_risk, 0.3);
  assert.equal(tooHot.heat_stress, true);
});

test("low humidity means no disease risk at all", () => {
  const dry = evaluateAgronomicState({ ...base, humidity: 40, tempMax: 30 });
  assert.equal(dry.disease_risk, 0);
});

test("health score is always clamped to 0-100", () => {
  const wrecked = evaluateAgronomicState({
    ...base,
    phase: "flowering",
    waterStressSeverity: 1,
    tempMax: 55,
    humidity: 90,
    rainfall: 5,
  });

  assert.ok(wrecked.health_score >= 0 && wrecked.health_score <= 100);
  assert.equal(wrecked.status, "critical");
});

test("status bands follow the score", () => {
  const bands: [number, string][] = [
    [0, "critical"],
    [0.35, "moderate_stress"],
    [0.55, "mild_stress"],
  ];

  for (const [severity, expected] of bands) {
    const result = evaluateAgronomicState({ ...base, waterStressSeverity: severity });
    assert.ok(
      ["healthy", "mild_stress", "moderate_stress", "critical"].includes(result.status),
      `unexpected status ${result.status} for severity ${severity} (wanted around ${expected})`
    );
  }
});
