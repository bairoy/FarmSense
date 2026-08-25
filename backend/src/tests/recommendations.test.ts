// Must precede every other import: the satellite services below reach
// config/env.ts, which throws when Supabase variables are absent.
import "./support/testEnv.ts";

import test from "node:test";
import assert from "node:assert/strict";
import { buildFertilizerPlan } from "../modules/recommendations/fertilizer.recommender.ts";
import { getTreatment, getConfidenceGate } from "../modules/rules/treatments.loader.ts";
import { assessConfidence } from "../modules/rules/confidence.ts";
import { sqmPerUnit } from "../utils/landUnits.ts";

const SQM_PER_BIGHA = sqmPerUnit("bigha");
import { detectTransplant } from "../modules/satellite/sentinel1.service.ts";
import { expectedNdvi } from "../modules/satellite/sentinel2.service.ts";

// =====================================================================
// Fertilizer
// =====================================================================

test("fertilizer quantities scale linearly with field area", () => {
  const one = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: SQM_PER_BIGHA,
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  const two = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: SQM_PER_BIGHA * 2,
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  assert.ok(Math.abs(two.season_total_kg.N - one.season_total_kg.N * 2) < 0.1);
});

test("season total matches the published per-hectare rate", () => {
  const plan = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: 10_000, // exactly 1 hectare
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  // UP Dept of Agriculture recommended dose for irrigated kharif rice: 120:60:60 kg/ha.
  assert.ok(Math.abs(plan.season_total_kg.N - 120) < 0.5);
  assert.ok(Math.abs(plan.season_total_kg.P2O5 - 60) < 0.5);
  assert.ok(Math.abs(plan.season_total_kg.K2O - 60) < 0.5);
});

test("DAP nitrogen is subtracted from the urea requirement", () => {
  const plan = buildFertilizerPlan({
    cropType: "wheat",
    areaSqm: 10_000,
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  const basal = plan.splits.find((s) => s.name === "basal")!;
  const dap = basal.products.find((p) => p.product === "dap")!;
  const urea = basal.products.find((p) => p.product === "urea");

  // Wheat basal at the UP irrigated rate (150:60:40): 75 kg N and 60 kg P2O5/ha.
  // DAP supplies P2O5 at 46%, so ~130.4 kg DAP, which carries ~23.5 kg N.
  // Urea should therefore cover ~51.5 kg N, i.e. ~112 kg urea - NOT the ~163 kg
  // you would get by ignoring DAP's nitrogen.
  assert.ok(Math.abs(dap.kg - 130.4) < 1, `dap ${dap.kg} kg`);
  assert.ok(urea!.kg < 125, `urea ${urea!.kg} kg suggests DAP nitrogen was not credited`);
  assert.ok(urea!.kg > 100);
});

test("water stress reduces nitrogen but not phosphorus or potassium", () => {
  const normal = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: 10_000,
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  const stressed = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: 10_000,
    cumulativeGDD: 100,
    waterStress: true,
    diseaseDetected: false,
  });

  // A water-stressed crop cannot take up nitrogen; applying the full dose
  // wastes it. P and K are less prone to loss and still needed.
  assert.ok(stressed.season_total_kg.N < normal.season_total_kg.N);
  assert.equal(stressed.season_total_kg.P2O5, normal.season_total_kg.P2O5);
  assert.ok(stressed.adjustments.length > 0);
});

test("the split due now tracks growth stage", () => {
  const early = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: 10_000,
    cumulativeGDD: 50,
    waterStress: false,
    diseaseDetected: false,
  });

  const late = buildFertilizerPlan({
    cropType: "rice",
    areaSqm: 10_000,
    cumulativeGDD: 1000,
    waterStress: false,
    diseaseDetected: false,
  });

  assert.equal(early.current_action?.name, "basal");
  assert.equal(late.current_action?.name, "panicle_initiation_topdress");
});

test("all phosphorus and potassium go in at basal", () => {
  const plan = buildFertilizerPlan({
    cropType: "wheat",
    areaSqm: 10_000,
    cumulativeGDD: 100,
    waterStress: false,
    diseaseDetected: false,
  });

  for (const split of plan.splits) {
    if (split.name === "basal") {
      assert.ok(split.nutrients_kg.P2O5 > 0);
    } else {
      // Phosphorus is immobile in soil - top-dressing it later does not reach
      // the roots.
      assert.equal(split.nutrients_kg.P2O5, 0);
    }
  }
});

test("an unknown crop is rejected rather than silently defaulted", () => {
  assert.throws(() =>
    buildFertilizerPlan({
      cropType: "maize",
      areaSqm: 10_000,
      cumulativeGDD: 100,
      waterStress: false,
      diseaseDetected: false,
    })
  );
});

// =====================================================================
// Disease treatment gating
// =====================================================================

test("a confident diagnosis returns a treatment", () => {
  const result = getTreatment("leaf_blast", 0.92);

  assert.equal(result.actionable, true);
  if (result.actionable) {
    assert.ok(result.treatment.chemical_treatment);
  }
});

test("a low-confidence diagnosis withholds the treatment", () => {
  // The classifier always returns a best guess - softmax has no "I don't
  // know". Refusing to act on a weak guess has to be an explicit decision.
  const result = getTreatment("leaf_blast", 0.4);

  assert.equal(result.actionable, false);
  if (!result.actionable) {
    assert.ok(result.guidance.actions.length > 0);
    assert.match(result.reason, /below/i);
  }
});

test("the gate boundary is inclusive", () => {
  const gate = getConfidenceGate();

  assert.equal(getTreatment("brown_spot", gate).actionable, true);
  assert.equal(getTreatment("brown_spot", gate - 0.001).actionable, false);
});

test("a healthy result recommends no chemical at all", () => {
  const result = getTreatment("healthy", 0.95);

  assert.equal(result.actionable, true);
  if (result.actionable) {
    assert.equal(result.treatment.chemical_treatment, null);
  }
});

test("hispa is treated as an insect, not a fungus", () => {
  const result = getTreatment("hispa", 0.9);

  if (result.actionable) {
    // Getting this class right matters more than the dose: a fungicide does
    // literally nothing to an insect infestation.
    assert.match(result.treatment.pathogen ?? "", /insect/i);
  }
});

test("an unknown class is not actionable", () => {
  assert.equal(getTreatment("bacterial_blight", 0.99).actionable, false);
});

// =====================================================================
// Confidence
// =====================================================================

test("a freshly corrected, well-measured field scores high", () => {
  const report = assessConfidence({
    daysSinceCorrection: 2,
    lastCloudFraction: 0.1,
    soilMeasured: true,
    weatherCompleteness: 1,
    hasFieldBoundary: true,
    daysSinceFarmerCheckin: 3,
    observationDisagreed: false,
  });

  assert.equal(report.band, "high");
  assert.ok(report.score > 0.8);
});

test("a never-corrected field with poor inputs scores low", () => {
  const report = assessConfidence({
    daysSinceCorrection: null,
    lastCloudFraction: null,
    soilMeasured: false,
    weatherCompleteness: 0.3,
    hasFieldBoundary: false,
    daysSinceFarmerCheckin: null,
    observationDisagreed: false,
  });

  assert.ok(["low", "very_low"].includes(report.band));
  assert.ok(report.factors.length >= 3);
  assert.match(report.caveat, /inspect|do not act/i);
});

test("confidence decays as the correction ages", () => {
  const inputs = {
    lastCloudFraction: 0.2,
    soilMeasured: true,
    weatherCompleteness: 1,
    hasFieldBoundary: true,
    daysSinceFarmerCheckin: 5,
    observationDisagreed: false,
  };

  const fresh = assessConfidence({ ...inputs, daysSinceCorrection: 3 });
  const week = assessConfidence({ ...inputs, daysSinceCorrection: 10 });
  const month = assessConfidence({ ...inputs, daysSinceCorrection: 40 });

  assert.ok(fresh.score > week.score);
  assert.ok(week.score > month.score);
});

test("a disagreeing observation lowers confidence and says why", () => {
  const inputs = {
    daysSinceCorrection: 2,
    lastCloudFraction: 0.1,
    soilMeasured: true,
    weatherCompleteness: 1,
    hasFieldBoundary: true,
    daysSinceFarmerCheckin: 2,
  };

  const agreeing = assessConfidence({ ...inputs, observationDisagreed: false });
  const disagreeing = assessConfidence({ ...inputs, observationDisagreed: true });

  // A disagreement is information: one of the two sources is wrong and we do
  // not yet know which.
  assert.ok(disagreeing.score < agreeing.score);
  assert.ok(disagreeing.factors.some((f) => /disagreed/i.test(f)));
});

test("confidence always carries a plain-language caveat", () => {
  for (const days of [1, 10, 30, 90]) {
    const report = assessConfidence({
      daysSinceCorrection: days,
      lastCloudFraction: 0.5,
      soilMeasured: true,
      weatherCompleteness: 0.9,
      hasFieldBoundary: true,
      daysSinceFarmerCheckin: 7,
      observationDisagreed: false,
    });

    assert.ok(report.caveat.length > 20);
    assert.ok(report.score > 0 && report.score <= 1);
  }
});

// =====================================================================
// Satellite interpretation
// =====================================================================

const s1 = (date: string, vhDb: number) => ({
  source: "sentinel1" as const,
  date,
  vhDb,
  vvDb: vhDb + 6,
  likelyFlooded: vhDb < -22,
  usable: true,
});

test("the V-shaped flooding signature is detected", () => {
  // Backscatter drops sharply when the field is flooded (water reflects the
  // radar pulse away), then recovers as the canopy develops.
  const series = [
    s1("2026-06-01", -15),
    s1("2026-06-07", -17),
    s1("2026-06-13", -25), // flooded
    s1("2026-06-19", -20),
    s1("2026-06-25", -16),
  ];

  const detection = detectTransplant(series);

  assert.equal(detection.detected, true);
  assert.equal(detection.transplantDate, "2026-06-13");
  assert.ok(detection.confidence > 0.5);
});

test("a permanently wet surface is not reported as a transplant", () => {
  // Requiring the recovery is what separates a paddy from a pond. Without it
  // this detector would call any wet surface a rice crop.
  const series = [
    s1("2026-06-01", -24),
    s1("2026-06-07", -25),
    s1("2026-06-13", -26),
    s1("2026-06-19", -25),
    s1("2026-06-25", -24),
  ];

  assert.equal(detectTransplant(series).detected, false);
});

test("a dry field with no flooding is not detected", () => {
  const series = [
    s1("2026-06-01", -14),
    s1("2026-06-07", -15),
    s1("2026-06-13", -16),
    s1("2026-06-19", -15),
    s1("2026-06-25", -14),
  ];

  assert.equal(detectTransplant(series).detected, false);
});

test("too few acquisitions is reported honestly, not guessed at", () => {
  const detection = detectTransplant([s1("2026-06-01", -15), s1("2026-06-13", -25)]);

  assert.equal(detection.detected, false);
  assert.equal(detection.confidence, 0);
  assert.match(detection.explanation, /usable/i);
});

test("a minimum at the window edge is not a confirmed detection", () => {
  const series = [
    s1("2026-06-01", -26), // minimum at the very start - no descent visible
    s1("2026-06-07", -20),
    s1("2026-06-13", -18),
    s1("2026-06-19", -16),
  ];

  const detection = detectTransplant(series);

  assert.equal(detection.detected, false);
  assert.match(detection.explanation, /edge/i);
});

test("unusable acquisitions are excluded from detection", () => {
  const series = [
    { ...s1("2026-06-01", -15), usable: false },
    { ...s1("2026-06-07", -17), usable: false },
    s1("2026-06-13", -25),
  ];

  assert.equal(detectTransplant(series).detected, false);
});

test("expected NDVI follows the crop growth curve", () => {
  const emergence = expectedNdvi(0.05, "wheat");
  const peak = expectedNdvi(0.45, "wheat");
  const senescence = expectedNdvi(0.95, "wheat");

  assert.ok(emergence < peak, "NDVI should rise from emergence to peak");
  assert.ok(senescence < peak, "NDVI should fall during senescence");
  assert.ok(emergence >= 0.1 && peak <= 0.9);
});

test("expected NDVI is bounded across the whole cycle", () => {
  for (let f = 0; f <= 1.2; f += 0.05) {
    for (const crop of ["wheat", "rice"] as const) {
      const value = expectedNdvi(f, crop);
      assert.ok(value > 0 && value < 1, `NDVI ${value} out of range at f=${f}`);
    }
  }
});
