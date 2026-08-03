import fs from "node:fs";

/**
 * Disease treatment lookup.
 *
 * Loaded once at module init: the file is small, read-only, and re-reading it
 * per request would put a synchronous disk read in the hot path of every
 * photo upload.
 */
const treatments = JSON.parse(
  fs.readFileSync(new URL("./disease.treatments.json", import.meta.url), "utf-8")
);

export type Treatment = {
  disease: string;
  label: string;
  label_ne?: string;
  severity: string;
  pathogen?: string;
  chemical_treatment: Record<string, unknown> | null;
  cultural_practice: string[];
  notes?: string;
};

export type GatedTreatment =
  | { actionable: true; treatment: Treatment }
  | { actionable: false; reason: string; guidance: typeof treatments.below_gate };

/**
 * Look up a treatment, but only if the classifier was confident enough.
 *
 * This gate is the reason the function exists. The classifier will always
 * return a best guess - softmax has no "I don't know" output - so refusing to
 * act on a weak guess has to be an explicit decision made here. Recommending
 * Tricyclazole for what is actually an insect infestation costs a farmer money
 * and does nothing for the crop.
 */
export const getTreatment = (
  diseaseClass: string,
  confidence: number
): GatedTreatment => {
  const gate: number = treatments._meta.confidence_gate;

  if (confidence < gate) {
    return {
      actionable: false,
      reason: `Confidence ${(confidence * 100).toFixed(0)}% is below the ${(gate * 100).toFixed(0)}% threshold required to name a treatment.`,
      guidance: treatments.below_gate,
    };
  }

  const entry = treatments.classes[diseaseClass];

  if (!entry) {
    return {
      actionable: false,
      reason: `No treatment record for class "${diseaseClass}".`,
      guidance: treatments.below_gate,
    };
  }

  return {
    actionable: true,
    treatment: { disease: diseaseClass, ...entry },
  };
};

export const getConfidenceGate = (): number => treatments._meta.confidence_gate;
