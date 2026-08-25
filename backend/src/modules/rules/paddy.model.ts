/**
 * Ponded-water model for transplanted, puddled lowland rice.
 *
 * This is NOT the wheat depletion model with different constants, and forcing
 * rice through that model is the single biggest physical error in the original
 * engine.
 *
 * In a puddled paddy the farmer maintains standing water over a deliberately
 * compacted plough pan. The state variable is water DEPTH IN MILLIMETRES ABOVE
 * THE SOIL SURFACE, not a soil moisture percentage:
 *
 *   - The soil is at or above saturation essentially all season. "Depletion
 *     below field capacity" is not a meaningful quantity there.
 *   - The crop's stress trigger is the water layer disappearing and the soil
 *     cracking, not a gradual soil-moisture decline.
 *   - Losses are dominated by percolation through the plough pan, which is a
 *     roughly constant mm/day rate, not by root-zone extraction.
 *
 * Reference: FAO-56 §7 (rice as a special case), and IRRI water management
 * guidance for lowland rice.
 *
 *   D_today = D_yesterday + P_eff + I - ETc - percolation, capped by the bund
 *
 * The model switches to a depletion regime only when the paddy has drained -
 * either the farmer is practising Alternate Wetting and Drying (AWD) or is at
 * the pre-harvest drainage stage.
 */

export type PaddyState = {
  /** Standing water above the soil surface, mm. Zero means drained. */
  pondedDepthMm: number;
  /** Once drained, how far the soil has dried below saturation, mm. */
  soilDepletionMm: number;
  /** Water lost over the bund, mm. */
  overflowMm: number;
  percolationMm: number;
  flooded: boolean;
  /** Consecutive days with no standing water. */
  dryDays: number;
};

export type PaddyConfig = {
  /** Bund height - the maximum water the field can physically hold, mm. */
  bundHeightMm: number;
  /** Target depth the farmer maintains during the vegetative stage, mm. */
  targetDepthMm: number;
  /**
   * Percolation + seepage through the plough pan, mm/day. Alluvial clay loam sits
   * around 2-5 mm/day once well puddled; a sandy or poorly puddled field can
   * lose 10+ and is far more expensive to irrigate.
   */
  percolationMmPerDay: number;
  /**
   * Soil water the crop can still use once ponding is gone, mm. Rice roots are
   * shallow and it has no drought adaptation, so this buffer is small - a few
   * days at most.
   */
  saturatedBufferMm: number;
};

export const defaultPaddyConfig: PaddyConfig = {
  bundHeightMm: 150,
  targetDepthMm: 50,
  percolationMmPerDay: 3,
  saturatedBufferMm: 40,
};

/**
 * Advance the paddy one day.
 *
 * Order matters: inputs land first, then losses are taken, then the model
 * decides whether any water is still standing. Taking losses before inputs
 * would let a field "run dry" on a day it was irrigated.
 */
export const stepPaddy = (
  previous: PaddyState,
  etc: number,
  rainfallMm: number,
  irrigationMm: number,
  config: PaddyConfig = defaultPaddyConfig
): PaddyState => {
  // Unlike upland fields, a bunded paddy retains essentially all rainfall
  // until the bund overtops - that is what the bund is for. So no runoff
  // coefficient is applied here.
  let depth = previous.pondedDepthMm + rainfallMm + irrigationMm;

  let overflow = 0;
  if (depth > config.bundHeightMm) {
    overflow = Number((depth - config.bundHeightMm).toFixed(2));
    depth = config.bundHeightMm;
  }

  // Percolation continues while there is standing water. Once the field
  // drains it falls off sharply, so we only charge it against ponded water.
  const percolation = depth > 0 ? config.percolationMmPerDay : 0;
  const totalLoss = etc + percolation;

  let soilDepletion = previous.soilDepletionMm;
  let dryDays = previous.dryDays;

  if (depth >= totalLoss) {
    // Still flooded after today's losses. Any earlier soil drying is undone -
    // standing water re-saturates the profile.
    depth -= totalLoss;
    soilDepletion = 0;
    dryDays = 0;
  } else {
    // The ponded layer ran out partway through the day. The remaining demand
    // comes out of the saturated soil buffer.
    const unmet = totalLoss - depth;
    depth = 0;
    soilDepletion = Math.min(config.saturatedBufferMm, soilDepletion + unmet);
    dryDays = previous.dryDays + 1;
  }

  // Re-flooding resets the dry-day counter even if losses ate the layer later
  // the same day.
  if (irrigationMm > 0 || rainfallMm > 20) {
    dryDays = 0;
  }

  return {
    pondedDepthMm: Number(Math.max(0, depth).toFixed(2)),
    soilDepletionMm: Number(Math.max(0, soilDepletion).toFixed(2)),
    overflowMm: overflow,
    percolationMm: percolation,
    flooded: depth > 0,
    dryDays,
  };
};

export const initialPaddyState = (): PaddyState => ({
  pondedDepthMm: 0,
  soilDepletionMm: 0,
  overflowMm: 0,
  percolationMm: 0,
  flooded: false,
  dryDays: 0,
});

/**
 * How much water to apply to restore the target ponding depth.
 *
 * Efficiency is higher than for upland irrigation because a bunded field
 * retains what is delivered - the loss is conveyance to the field, not
 * distribution within it.
 */
export const paddyIrrigationRequirement = (
  state: PaddyState,
  config: PaddyConfig = defaultPaddyConfig,
  conveyanceEfficiency = 0.75
): number => {
  const deficit =
    Math.max(0, config.targetDepthMm - state.pondedDepthMm) +
    state.soilDepletionMm;

  return Number((deficit / conveyanceEfficiency).toFixed(1));
};

/**
 * Rice stress assessment.
 *
 * Phase-aware because rice tolerates drying very differently across the
 * season. Flowering is the critical window: water deficit there causes
 * spikelet sterility, which is unrecoverable - the panicle simply does not
 * fill, no matter how well the field is managed afterwards.
 */
export const assessPaddyStress = (
  state: PaddyState,
  phase: string,
  config: PaddyConfig = defaultPaddyConfig
): { stressed: boolean; severity: number; reason: string | null } => {
  const criticalPhases = ["flowering", "reproductive", "panicle_initiation"];

  if (state.flooded) {
    return { stressed: false, severity: 0, reason: null };
  }

  if (criticalPhases.includes(phase)) {
    // No tolerance at all during flowering. One dry day here matters.
    return {
      stressed: true,
      severity: Math.min(1, 0.4 + state.dryDays * 0.2),
      reason: `Field is not flooded during ${phase}. Water deficit now causes spikelet sterility, which cannot be recovered later.`,
    };
  }

  if (phase === "grain_filling" || phase === "maturity") {
    // Late-season drying is normal and intentional - the farmer drains before
    // harvest. Not a stress signal.
    return { stressed: false, severity: 0, reason: null };
  }

  // Vegetative stage: AWD is a legitimate practice, so a short dry spell is
  // acceptable. Stress only once the soil buffer is genuinely drawn down.
  const bufferUsed = state.soilDepletionMm / config.saturatedBufferMm;

  if (bufferUsed > 0.7 || state.dryDays >= 5) {
    return {
      stressed: true,
      severity: Math.min(1, bufferUsed),
      reason: `Paddy has been dry for ${state.dryDays} day(s) and the soil buffer is ${(bufferUsed * 100).toFixed(0)}% used.`,
    };
  }

  return { stressed: false, severity: 0, reason: null };
};
