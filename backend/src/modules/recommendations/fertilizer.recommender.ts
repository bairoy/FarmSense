import fs from "node:fs";
import { describeArea, sqmToHectares } from "../../utils/landUnits.ts";

/**
 * Fertilizer recommendation: rate table x field area.
 *
 * The arithmetic is trivial. What matters is where each number comes from:
 *
 *   rate      -> fertilizer.rates.json (NARC/DoA published doses)
 *   area      -> the field's canonical area_sqm
 *   product   -> derived from nutrient content, not guessed
 *
 * No language model touches any of these. An LLM asked for "how much urea for
 * my rice" will produce a fluent, confident, and occasionally wrong number,
 * and the farmer has no way to tell the difference. The agent's job is to
 * explain this output, not to compute it.
 */

const rates = JSON.parse(
  fs.readFileSync(new URL("../rules/fertilizer.rates.json", import.meta.url), "utf-8")
);

export type FertilizerSplit = {
  name: string;
  timing: string;
  phase: string;
  due: "overdue" | "due_now" | "upcoming" | "passed";
  nutrients_kg: { N: number; P2O5: number; K2O: number };
  products: { product: string; label: string; kg: number; local_units: string }[];
  note: string;
};

export type FertilizerPlan = {
  crop: string;
  area: ReturnType<typeof describeArea>;
  season_total_kg: { N: number; P2O5: number; K2O: number };
  organic_recommendation: string;
  splits: FertilizerSplit[];
  current_action: FertilizerSplit | null;
  adjustments: { applied: string; reason: string; multiplier: number }[];
  caveats: string[];
};

/**
 * Works out which products supply the required nutrients.
 *
 * Order matters and is not arbitrary. DAP is applied first because it is the
 * only phosphorus source here and it also carries 18% nitrogen. That nitrogen
 * is then SUBTRACTED from the urea requirement - a farmer who applies the full
 * urea dose on top of DAP over-applies nitrogen by roughly 20%, which is the
 * most common fertilizer arithmetic error in practice.
 */
const toProducts = (
  nutrients: { N: number; P2O5: number; K2O: number },
  areaSqm: number
) => {
  const content = rates.nutrient_content;
  const products: FertilizerSplit["products"] = [];

  let remainingN = nutrients.N;

  if (nutrients.P2O5 > 0) {
    const dapKg = nutrients.P2O5 / content.dap.P2O5;
    remainingN = Math.max(0, remainingN - dapKg * content.dap.N);
    products.push(buildProduct("dap", dapKg, areaSqm));
  }

  if (nutrients.K2O > 0) {
    products.push(buildProduct("mop", nutrients.K2O / content.mop.K2O, areaSqm));
  }

  if (remainingN > 0.5) {
    products.push(buildProduct("urea", remainingN / content.urea.N, areaSqm));
  }

  return products;
};

/**
 * Formats a quantity in units a farmer can actually act on.
 *
 * "23.4 kg" is correct and useless at a shop that sells 50 kg sacks. Below
 * about a kilo we switch to grams, because "0.4 kg" invites a decimal error
 * that "400 g" does not.
 */
const buildProduct = (key: string, kg: number, areaSqm: number) => {
  const rounded = Number(kg.toFixed(1));
  const sacks = rounded / 50;

  const local =
    rounded < 1
      ? `${Math.round(rounded * 1000)} g`
      : sacks >= 0.5
        ? `${rounded} kg (about ${sacks.toFixed(1)} sacks of 50 kg)`
        : `${rounded} kg`;

  return {
    product: key,
    label: rates.nutrient_content[key].label,
    kg: rounded,
    local_units: local,
  };
};

const splitStatus = (
  split: any,
  cumulativeGDD: number
): FertilizerSplit["due"] => {
  if (cumulativeGDD < split.gdd_start) return "upcoming";
  if (cumulativeGDD > split.gdd_end) return "passed";

  // Within the window. The first fifth of it is "due now"; deeper in and the
  // farmer is running late, which is worth saying plainly.
  const through = (cumulativeGDD - split.gdd_start) / (split.gdd_end - split.gdd_start);
  return through > 0.5 ? "overdue" : "due_now";
};

export const buildFertilizerPlan = (input: {
  cropType: string;
  areaSqm: number;
  cumulativeGDD: number;
  waterStress: boolean;
  diseaseDetected: boolean;
  alreadyApplied?: string[];
}): FertilizerPlan => {
  const config = rates.crops[input.cropType];

  if (!config) {
    throw new Error(`No fertilizer rate table for crop "${input.cropType}"`);
  }

  const hectares = sqmToHectares(input.areaSqm);
  const adjustments: FertilizerPlan["adjustments"] = [];

  // Stress adjustments reduce nitrogen only. Phosphorus and potassium are not
  // reduced: they are less prone to loss and a stressed crop still needs them.
  let nMultiplier = 1;

  if (input.waterStress && config.stress_adjustments?.water_stress) {
    const adj = config.stress_adjustments.water_stress;
    nMultiplier *= adj.N_multiplier;
    adjustments.push({
      applied: "water_stress",
      reason: adj.reason,
      multiplier: adj.N_multiplier,
    });
  }

  if (input.diseaseDetected && config.stress_adjustments?.disease_detected) {
    const adj = config.stress_adjustments.disease_detected;
    nMultiplier *= adj.N_multiplier;
    adjustments.push({
      applied: "disease_detected",
      reason: adj.reason,
      multiplier: adj.N_multiplier,
    });
  }

  const splits: FertilizerSplit[] = config.splits.map((split: any) => {
    const nutrients = {
      N: Number((config.total_per_hectare.N * split.fraction.N * hectares * nMultiplier).toFixed(2)),
      P2O5: Number((config.total_per_hectare.P2O5 * split.fraction.P2O5 * hectares).toFixed(2)),
      K2O: Number((config.total_per_hectare.K2O * split.fraction.K2O * hectares).toFixed(2)),
    };

    return {
      name: split.name,
      timing: split.timing,
      phase: split.phase,
      due: splitStatus(split, input.cumulativeGDD),
      nutrients_kg: nutrients,
      products: toProducts(nutrients, input.areaSqm),
      note: split.note,
    };
  });

  const current =
    splits.find((s) => s.due === "overdue") ??
    splits.find((s) => s.due === "due_now") ??
    null;

  const caveats = [
    "These are district-level recommended doses. If you have a soil test for this field, its values should be used instead.",
    "Quantities are computed from the field area recorded in FarmSense. Check that area is right before buying fertilizer.",
  ];

  if (adjustments.length > 0) {
    caveats.push(
      "The nitrogen dose has been reduced from the standard rate because of current crop conditions - see the adjustments listed above."
    );
  }

  return {
    crop: input.cropType,
    area: describeArea(input.areaSqm),
    season_total_kg: {
      N: Number((config.total_per_hectare.N * hectares * nMultiplier).toFixed(2)),
      P2O5: Number((config.total_per_hectare.P2O5 * hectares).toFixed(2)),
      K2O: Number((config.total_per_hectare.K2O * hectares).toFixed(2)),
    },
    organic_recommendation: config.organic_recommendation,
    splits,
    current_action: current,
    adjustments,
    caveats,
  };
};
