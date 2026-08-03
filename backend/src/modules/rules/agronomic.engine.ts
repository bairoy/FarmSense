/**
 * Agronomic interpretation layer.
 *
 * This module answers "what does this physical state mean for the crop?" It is
 * deliberately pure: no I/O, no dates, no database. That is what makes it
 * cheap to unit-test exhaustively, which matters because these numbers drive
 * real spending decisions.
 *
 * The split from the water models is intentional. `waterBalance.ts` and
 * `paddy.model.ts` compute physics and hand over a normalised stress severity
 * (0 = fine, 1 = the crop can extract nothing). This module never sees
 * millimetres, so it works identically for a flooded paddy and a wheat field
 * whose state variables have nothing in common.
 */

export type AgronomicInputs = {
  crop: string;
  phase: string;
  /** Normalised water stress from the water model, 0-1. */
  waterStressSeverity: number;
  /** Human-readable cause, supplied by whichever water model produced it. */
  waterStressReason: string | null;
  tempMax: number;
  humidity: number;
  rainfall: number;
  isPaddy: boolean;
  flooded?: boolean;
  cropConfig: {
    max_temperature_threshold_c: number;
    critical_flowering_temp_c?: number;
  };
};

export type AgronomicResult = {
  health_score: number;
  status: string;
  water_stress: boolean;
  heat_stress: boolean;
  disease_risk: number;
  stress_factors: string[];
  recommendations: string[];
};

/** Phases where a stress event does permanent, unrecoverable yield damage. */
const CRITICAL_PHASES = new Set(["flowering", "reproductive", "panicle_initiation"]);

export const evaluateAgronomicState = (input: AgronomicInputs): AgronomicResult => {
  const stress_factors: string[] = [];
  const recommendations: string[] = [];

  let health_score = 100;
  let water_stress = false;
  let heat_stress = false;
  let disease_risk = 0;

  const isCritical = CRITICAL_PHASES.has(input.phase);

  // =====================================================================
  // WATER
  // =====================================================================
  if (input.waterStressSeverity > 0) {
    water_stress = true;

    // Penalty is weighted by phase. The same deficit costs far more yield at
    // flowering than during tillering, because a crop can compensate for lost
    // vegetative growth and cannot recover a sterile panicle.
    const maxPenalty = isCritical ? 55 : 40;
    health_score -= input.waterStressSeverity * maxPenalty;

    stress_factors.push(input.waterStressReason ?? "water stress");

    if (isCritical) {
      recommendations.push(
        `Irrigate now. ${input.phase} is the yield-critical window - water deficit here causes losses that cannot be recovered later in the season.`
      );
    } else if (input.waterStressSeverity > 0.5) {
      recommendations.push("Irrigate soon; the crop is drawing on water it cannot easily extract.");
    } else {
      recommendations.push("Soil water is approaching the stress threshold. Plan to irrigate within the next few days.");
    }
  }

  // Rainfall does not cancel stress - that was a bug in the earlier engine,
  // which set `water_stress = false` on any 10mm day regardless of how deep
  // the deficit was. 10mm on a 90mm deficit is not relief. The water models
  // already credited this rainfall; the severity handed to us reflects it.
  if (input.rainfall > 10 && water_stress) {
    recommendations.push(
      `${input.rainfall.toFixed(0)} mm of rain fell today and is already counted in the water balance above. Irrigation is still indicated because it did not close the deficit.`
    );
  }

  // Paddy-specific: too much water is also a problem.
  if (input.isPaddy && input.flooded === false && !water_stress) {
    recommendations.push(
      "The paddy is currently drained. This is normal for alternate wetting and drying, or before harvest - re-flood if neither applies."
    );
  }

  // =====================================================================
  // HEAT
  // =====================================================================
  // Flowering has its own, lower threshold. Rice spikelet sterility begins
  // around 33-35C at anthesis, well below the temperature that would stress
  // the same plant vegetatively.
  const threshold =
    isCritical && input.cropConfig.critical_flowering_temp_c
      ? input.cropConfig.critical_flowering_temp_c
      : input.cropConfig.max_temperature_threshold_c;

  const heatExcess = input.tempMax - threshold;

  if (heatExcess > 0) {
    heat_stress = true;
    health_score -= Math.min(isCritical ? 40 : 30, heatExcess * (isCritical ? 5 : 3));

    stress_factors.push(
      isCritical
        ? `heat stress during ${input.phase} (${input.tempMax.toFixed(0)}C vs ${threshold}C threshold)`
        : `high temperature (${input.tempMax.toFixed(0)}C)`
    );

    if (input.isPaddy) {
      recommendations.push(
        "Raise the standing water depth. A deeper water layer buffers the panicle against heat and is the main lever available during a heat spell."
      );
    } else if (heatExcess > 4) {
      recommendations.push(
        "Severe heat stress. Irrigating cools the canopy through transpiration, so keep soil water well above the stress threshold during the hot spell."
      );
    } else {
      recommendations.push("High temperature - monitor the crop closely.");
    }
  }

  // =====================================================================
  // DISEASE RISK (environmental proxy)
  // =====================================================================
  // This estimates whether conditions FAVOUR fungal infection. It is not a
  // diagnosis - that comes from the image classifier, which looks at the
  // actual plant. Keeping the two separate matters: this number should raise
  // vigilance, never trigger a spray on its own.
  if (input.humidity > 80 && input.tempMax > 25 && input.tempMax < 35) {
    disease_risk = input.rainfall > 2 ? 0.8 : 0.6;

    health_score -= disease_risk * 15;
    stress_factors.push("high humidity favouring fungal infection");
    recommendations.push(
      "Conditions favour fungal disease (blast, brown spot). Inspect the crop and photograph any lesions for diagnosis before applying anything."
    );
  } else if (input.humidity > 70) {
    disease_risk = 0.3;
  }

  health_score = Math.max(0, Math.min(100, health_score));

  return {
    health_score: Math.round(health_score),
    status:
      health_score > 85
        ? "healthy"
        : health_score > 65
          ? "mild_stress"
          : health_score > 40
            ? "moderate_stress"
            : "critical",
    water_stress,
    heat_stress,
    disease_risk: Number(disease_risk.toFixed(2)),
    stress_factors,
    recommendations,
  };
};
