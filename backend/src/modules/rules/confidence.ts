/**
 * Confidence and staleness as a first-class output.
 *
 * This is a safety requirement, not a nice-to-have. Every number this system
 * produces is an *estimate* from a simulation that has been running unchecked
 * since the last independent observation. Presenting "health 82" with the same
 * visual weight whether it was corrected against a satellite pass yesterday or
 * has been free-running for three weeks is the failure mode that gets a farmer
 * to act on a bad recommendation.
 *
 * The score degrades along four independent axes. They multiply rather than
 * average, because they are compounding failures: an old estimate built on
 * poor weather data over an unmeasured soil is not "somewhat less certain", it
 * is barely an estimate at all.
 */

export type ConfidenceInputs = {
  /** Days since the last usable satellite correction. */
  daysSinceCorrection: number | null;
  /** Cloud fraction of the most recent attempted optical pass, 0-1. */
  lastCloudFraction: number | null;
  /** True when soil hydraulics came from SoilGrids, not district defaults. */
  soilMeasured: boolean;
  /** Share of simulated days that had full Penman-Monteith inputs, 0-1. */
  weatherCompleteness: number;
  /** True when the field has a traced boundary rather than a dropped pin. */
  hasFieldBoundary: boolean;
  /** Days since the farmer last confirmed anything in person. */
  daysSinceFarmerCheckin: number | null;
  /** True when an observation contradicted the simulation. */
  observationDisagreed: boolean;
};

export type ConfidenceReport = {
  score: number;
  band: "high" | "medium" | "low" | "very_low";
  stale_days: number | null;
  factors: string[];
  /** Plain-language summary intended to be shown to the farmer verbatim. */
  caveat: string;
};

/**
 * Correction decay.
 *
 * Anchored to the 6-day Sentinel-1C/1D revisit: an estimate corrected within
 * one revisit cycle is as good as this system gets. Past roughly a month of
 * free-running simulation, accumulated error in ETo, effective rainfall and
 * unreported irrigation dominates whatever the model says.
 */
const correctionFactor = (days: number | null): number => {
  if (days === null) return 0.55; // never corrected
  if (days <= 6) return 1.0;
  if (days <= 12) return 0.9;
  if (days <= 21) return 0.78;
  if (days <= 30) return 0.65;
  return 0.5;
};

const checkinFactor = (days: number | null): number => {
  if (days === null) return 0.92; // never checked in - a mild penalty only
  if (days <= 7) return 1.0;
  if (days <= 14) return 0.97;
  return 0.93;
};

export const assessConfidence = (input: ConfidenceInputs): ConfidenceReport => {
  const factors: string[] = [];

  let score = correctionFactor(input.daysSinceCorrection);
  if (input.daysSinceCorrection === null) {
    factors.push("No satellite correction has ever been applied to this field.");
  } else if (input.daysSinceCorrection > 12) {
    factors.push(
      `Last satellite correction was ${input.daysSinceCorrection} days ago; the estimate has been free-running since.`
    );
  }

  if (input.lastCloudFraction !== null && input.lastCloudFraction > 0.7) {
    score *= 0.9;
    factors.push(
      `The most recent optical pass was ${(input.lastCloudFraction * 100).toFixed(0)}% cloud-obscured.`
    );
  }

  if (!input.soilMeasured) {
    score *= 0.85;
    factors.push(
      "Soil water-holding capacity is a district-wide default, not measured for this field."
    );
  }

  // Weather completeness scales rather than steps: half the season on
  // Hargreaves ETo is meaningfully worse than a couple of gap days.
  score *= 0.7 + 0.3 * Math.max(0, Math.min(1, input.weatherCompleteness));
  if (input.weatherCompleteness < 0.8) {
    factors.push(
      `Full radiation and wind data was available for only ${(input.weatherCompleteness * 100).toFixed(0)}% of simulated days; the rest used a reduced ETo method.`
    );
  }

  if (!input.hasFieldBoundary) {
    score *= 0.88;
    factors.push(
      "No field boundary has been traced, so satellite values are sampled from an approximate box around the map pin."
    );
  }

  score *= checkinFactor(input.daysSinceFarmerCheckin);

  if (input.observationDisagreed) {
    // A disagreement is information, not noise. It means at least one of the
    // two sources is wrong and we do not yet know which.
    score *= 0.8;
    factors.push(
      "An independent observation disagreed with the simulation; the estimate has been pulled toward the observation and its uncertainty widened."
    );
  }

  score = Number(Math.max(0.05, Math.min(1, score)).toFixed(3));

  const band: ConfidenceReport["band"] =
    score >= 0.8 ? "high" : score >= 0.6 ? "medium" : score >= 0.4 ? "low" : "very_low";

  const caveat =
    band === "high"
      ? "This estimate was recently checked against independent data."
      : band === "medium"
        ? "This is a modelled estimate with some independent grounding. Confirm against what you see in the field before acting."
        : band === "low"
          ? "This estimate has not been checked against independent data recently. Treat it as a rough guide and inspect the field yourself."
          : "Confidence is very low. Do not act on this estimate alone - inspect the field, or contact your local agriculture extension officer.";

  return {
    score,
    band,
    stale_days: input.daysSinceCorrection,
    factors,
    caveat,
  };
};
