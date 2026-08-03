/**
 * FAO-56 soil water balance for upland (non-flooded) crops - wheat here.
 *
 * The root zone is modelled as a bucket. We track *depletion*: how far below
 * field capacity the bucket has fallen, in mm.
 *
 *   Dr_today = Dr_yesterday + ETc - (P_eff + I) + DP
 *
 * Reference: FAO-56 chapter 8, eq. 85.
 *
 * Two things this gets right that a 0-100 "soil moisture" percentage cannot:
 *
 *   1. It is in millimetres, the same unit as rainfall and irrigation, so the
 *      irrigation dosage falls straight out of the model instead of needing an
 *      invented conversion.
 *   2. The stress threshold moves with the crop. RAW depends on root depth,
 *      which grows through the season - a 20 mm deficit is nothing to a mature
 *      wheat crop and serious to a seedling.
 */

export type SoilCapacity = {
  /** Total Available Water in the root zone, mm. */
  TAW: number;
  /** Readily Available Water: the part extractable without stress, mm. */
  RAW: number;
  /** Depletion fraction p used to derive RAW. */
  p: number;
  rootDepthM: number;
};

/**
 * TAW and RAW for the current root depth.
 *
 *   TAW = (θ_FC - θ_WP) x Zr        (FAO-56 eq. 82)
 *   RAW = p x TAW                    (FAO-56 eq. 83)
 *
 * `p` is adjusted for evaporative demand per FAO-56 eq. 84: on a high-ETc day
 * the crop hits stress at a *shallower* depletion, because water cannot move
 * to the roots fast enough even though it is still physically present.
 */
export const soilCapacity = (
  tawMmPerM: number,
  rootDepthM: number,
  pTable: number,
  etcMmPerDay: number
): SoilCapacity => {
  const TAW = tawMmPerM * rootDepthM;

  // eq. 84, clamped to the 0.1-0.8 range the paper states it is valid over.
  const pAdjusted = Math.max(
    0.1,
    Math.min(0.8, pTable + 0.04 * (5 - etcMmPerDay))
  );

  return {
    TAW: Number(TAW.toFixed(2)),
    RAW: Number((pAdjusted * TAW).toFixed(2)),
    p: Number(pAdjusted.toFixed(3)),
    rootDepthM,
  };
};

/**
 * Root depth grows linearly with thermal time until it reaches the crop's
 * maximum. Modelling this matters early in the season: treating a 5-day-old
 * seedling as if it could reach 1.5 m of soil badly overestimates how much
 * water it has access to.
 */
export const currentRootDepth = (
  cumulativeGDD: number,
  gddToFullRoot: number,
  minDepthM: number,
  maxDepthM: number
): number => {
  const fraction = Math.max(0, Math.min(1, cumulativeGDD / gddToFullRoot));
  return Number((minDepthM + (maxDepthM - minDepthM) * fraction).toFixed(3));
};

/**
 * Effective rainfall: the share of a rainfall event that actually enters the
 * root zone rather than running off.
 *
 * USDA-SCS style approximation. A 60 mm cloudburst on Terai clay loam does not
 * deliver 60 mm to the roots - most of it leaves as surface runoff. Counting
 * it in full would make the model believe the field is irrigated when it is
 * not, which is exactly the wrong direction for an irrigation recommendation.
 */
export const effectiveRainfall = (rainfallMm: number): number => {
  if (rainfallMm <= 0) return 0;
  if (rainfallMm <= 25) return Number((rainfallMm * 0.9).toFixed(2));
  if (rainfallMm <= 50) return Number((22.5 + (rainfallMm - 25) * 0.7).toFixed(2));
  return Number((40 + (rainfallMm - 50) * 0.4).toFixed(2));
};

export type BalanceStep = {
  depletion: number;
  deepPercolation: number;
  runoff: number;
  /** Water stress coefficient Ks, 0-1. 1 = no stress. */
  Ks: number;
  /** Actual (stress-adjusted) crop evapotranspiration, mm. */
  ETa: number;
};

/**
 * Advance the balance one day.
 *
 * The Ks feedback is what makes this a model rather than a subtraction. A
 * stressed crop closes its stomata and transpires *less*, which slows further
 * depletion. Without Ks the simulated soil dries to zero far too fast and
 * every crop looks dead by mid-season.
 *
 *   Ks = (TAW - Dr) / (TAW - RAW)   for Dr > RAW    (FAO-56 eq. 84)
 */
export const stepWaterBalance = (
  previousDepletion: number,
  etc: number,
  rainfallMm: number,
  irrigationMm: number,
  capacity: SoilCapacity
): BalanceStep => {
  const pEff = effectiveRainfall(rainfallMm);
  const runoff = Number((rainfallMm - pEff).toFixed(2));

  // Ks is evaluated on yesterday's depletion - the crop responds to the water
  // status it woke up to, not to a value that depends on today's own outcome.
  const Ks =
    previousDepletion <= capacity.RAW
      ? 1
      : Math.max(
          0,
          (capacity.TAW - previousDepletion) / (capacity.TAW - capacity.RAW)
        );

  const ETa = etc * Ks;

  let depletion = previousDepletion + ETa - pEff - irrigationMm;

  // Negative depletion means the bucket overflowed. That water is gone below
  // the root zone - it is not credit against tomorrow's demand.
  let deepPercolation = 0;
  if (depletion < 0) {
    deepPercolation = Number((-depletion).toFixed(2));
    depletion = 0;
  }

  // Depletion cannot exceed TAW: the crop cannot extract water that is not
  // there. Past this point the crop is dying, not drying further.
  depletion = Math.min(depletion, capacity.TAW);

  return {
    depletion: Number(depletion.toFixed(2)),
    deepPercolation,
    runoff,
    Ks: Number(Ks.toFixed(3)),
    ETa: Number(ETa.toFixed(3)),
  };
};

/**
 * Irrigation depth needed to refill the root zone to field capacity.
 *
 * Divided by application efficiency: a farmer running a canal or a diesel pump
 * onto a Terai plot loses a substantial fraction to conveyance and uneven
 * distribution, so applying exactly `depletion` mm leaves the field short.
 */
export const irrigationRequirement = (
  depletion: number,
  applicationEfficiency = 0.65
): number =>
  Number((Math.max(0, depletion) / applicationEfficiency).toFixed(1));
