/**
 * FAO-56 Penman-Monteith reference evapotranspiration.
 *
 * Reference: Allen, R.G., Pereira, L.S., Raes, D., Smith, M. (1998).
 * "Crop evapotranspiration - Guidelines for computing crop water
 * requirements". FAO Irrigation and Drainage Paper 56. Equation numbers below
 * refer to that document.
 *
 * ETo is the evaporative demand of a hypothetical reference grass surface:
 * 0.12 m tall, surface resistance 70 s/m, albedo 0.23. It depends only on
 * weather, never on the crop. The crop enters later, as Kc.
 *
 * Why implement this when Open-Meteo already returns `et0_fao_evapotranspiration`:
 *   - Open-Meteo's value is a black box we cannot audit or unit-test.
 *   - It is unavailable for forecast days in some configurations, and the
 *     irrigation-timing decision needs forecast ETo.
 *   - NASA POWER supplies better radiation and wind for agro-climatology, and
 *     mixing its inputs into someone else's ETo formula is not sound.
 *
 * The Open-Meteo value is still fetched and used to cross-check ours - a large
 * divergence means one of the inputs is wrong.
 */

const SOLAR_CONSTANT = 0.0820; // MJ m-2 min-1
const STEFAN_BOLTZMANN = 4.903e-9; // MJ K-4 m-2 day-1
const ALBEDO_REFERENCE_GRASS = 0.23;

export type EtoInputs = {
  tempMaxC: number;
  tempMinC: number;
  /** Mean relative humidity, %. */
  humidityPct: number;
  /** Wind speed at 2 m, m/s. */
  windSpeed2m: number;
  /** Incoming shortwave solar radiation, MJ m-2 day-1. */
  solarRadiationMj: number;
  /** Field latitude in decimal degrees. */
  latitude: number;
  /** Elevation above sea level, m. Siraha (Terai) sits near 100 m. */
  elevationM: number;
  /** Day of year, 1-366. */
  dayOfYear: number;
};

/** Saturation vapour pressure at temperature T (kPa). FAO-56 eq. 11. */
export const saturationVapourPressure = (tempC: number): number =>
  0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));

/** Slope of the vapour pressure curve (kPa/degC). FAO-56 eq. 13. */
export const vapourPressureSlope = (tempMeanC: number): number =>
  (4098 * saturationVapourPressure(tempMeanC)) /
  Math.pow(tempMeanC + 237.3, 2);

/**
 * Psychrometric constant (kPa/degC). FAO-56 eq. 8.
 *
 * Derived from atmospheric pressure, which we get from elevation (eq. 7)
 * rather than measuring it.
 */
export const psychrometricConstant = (elevationM: number): number => {
  const pressureKpa = 101.3 * Math.pow((293 - 0.0065 * elevationM) / 293, 5.26);
  return 0.000665 * pressureKpa;
};

/** Extraterrestrial radiation Ra (MJ m-2 day-1). FAO-56 eq. 21. */
export const extraterrestrialRadiation = (
  latitude: number,
  dayOfYear: number
): number => {
  const phi = (Math.PI / 180) * latitude;

  // Inverse relative Earth-Sun distance (eq. 23)
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * dayOfYear) / 365);
  // Solar declination (eq. 24)
  const delta = 0.409 * Math.sin((2 * Math.PI * dayOfYear) / 365 - 1.39);

  // Sunset hour angle (eq. 25). Clamped because at high latitudes the
  // argument can leave [-1, 1] (polar day/night) and acos would return NaN.
  const tanProduct = Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta)));
  const omega = Math.acos(tanProduct);

  return (
    ((24 * 60) / Math.PI) *
    SOLAR_CONSTANT *
    dr *
    (omega * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(omega))
  );
};

/** Net radiation at the crop surface (MJ m-2 day-1). FAO-56 eqs. 38-40. */
export const netRadiation = (
  solarRadiationMj: number,
  extraterrestrialMj: number,
  tempMaxC: number,
  tempMinC: number,
  actualVapourPressure: number,
  elevationM: number
): number => {
  // Net shortwave: what the surface absorbs after reflecting 23% (eq. 38).
  const netShortwave = (1 - ALBEDO_REFERENCE_GRASS) * solarRadiationMj;

  // Clear-sky radiation (eq. 37), the reference for how cloudy today was.
  const clearSky = (0.75 + 2e-5 * elevationM) * extraterrestrialMj;

  // Relative shortwave. Clamped to 1: measurement noise can make the ratio
  // exceed unity, which would flip the sign of the cloudiness term.
  const relative = clearSky > 0 ? Math.min(solarRadiationMj / clearSky, 1.0) : 1.0;

  // Net longwave: heat radiated back to the sky (eq. 39).
  const tMaxK4 = Math.pow(tempMaxC + 273.16, 4);
  const tMinK4 = Math.pow(tempMinC + 273.16, 4);

  const netLongwave =
    STEFAN_BOLTZMANN *
    ((tMaxK4 + tMinK4) / 2) *
    (0.34 - 0.14 * Math.sqrt(Math.max(0, actualVapourPressure))) *
    (1.35 * relative - 0.35);

  return netShortwave - netLongwave;
};

/**
 * Reference evapotranspiration ETo in mm/day. FAO-56 eq. 6.
 *
 *            0.408 * Δ * (Rn - G) + γ * (900/(T+273)) * u2 * (es - ea)
 *   ETo =  ------------------------------------------------------------
 *                        Δ + γ * (1 + 0.34 * u2)
 *
 * The numerator has two halves: a radiation term (energy available to
 * evaporate water) and an aerodynamic term (the air's capacity to carry that
 * vapour away). Both are needed - a hot still day and a warm windy day have
 * very different water demand, which is exactly what the old
 * `evap = tempMax * 0.2` heuristic could not see.
 */
export const calculateEto = (input: EtoInputs): number => {
  const tMean = (input.tempMaxC + input.tempMinC) / 2;

  const delta = vapourPressureSlope(tMean);
  const gamma = psychrometricConstant(input.elevationM);

  // Saturation vapour pressure from the daily extremes, not from Tmean:
  // FAO-56 eq. 12 is explicit that averaging es(Tmax) and es(Tmin)
  // underestimates less than es(Tmean) does, because the curve is convex.
  const es =
    (saturationVapourPressure(input.tempMaxC) +
      saturationVapourPressure(input.tempMinC)) /
    2;

  // Actual vapour pressure from mean RH (eq. 19).
  const ea = es * (Math.max(0, Math.min(100, input.humidityPct)) / 100);

  const ra = extraterrestrialRadiation(input.latitude, input.dayOfYear);
  const rn = netRadiation(
    input.solarRadiationMj,
    ra,
    input.tempMaxC,
    input.tempMinC,
    ea,
    input.elevationM
  );

  // Soil heat flux G is taken as zero on a daily step - FAO-56 §3.5 notes it
  // is small relative to Rn over 24 hours.
  const G = 0;

  // Wind is measured at 2m. Values below 0.5 m/s are unphysical for a daily
  // mean and make the aerodynamic term collapse, so FAO-56 §3.4 recommends
  // this floor.
  const u2 = Math.max(0.5, input.windSpeed2m);

  const radiationTerm = 0.408 * delta * (rn - G);
  const aerodynamicTerm =
    gamma * (900 / (tMean + 273)) * u2 * Math.max(0, es - ea);

  const eto = (radiationTerm + aerodynamicTerm) / (delta + gamma * (1 + 0.34 * u2));

  // ETo cannot be negative. On a cold overcast day the radiation term can go
  // slightly negative; physically that means no evaporation, not condensation
  // we can bank.
  return Math.max(0, Number(eto.toFixed(3)));
};

/**
 * Hargreaves-Samani fallback (FAO-56 eq. 52).
 *
 * Needs only temperature and latitude. Used when radiation or wind data is
 * missing - typically for forecast days beyond NASA POWER's horizon. Less
 * accurate than Penman-Monteith, which is precisely why the crop state that
 * uses it reports lower confidence.
 */
export const calculateEtoHargreaves = (
  tempMaxC: number,
  tempMinC: number,
  latitude: number,
  dayOfYear: number
): number => {
  const tMean = (tempMaxC + tempMinC) / 2;
  const ra = extraterrestrialRadiation(latitude, dayOfYear);
  const tempRange = Math.max(0, tempMaxC - tempMinC);

  const eto = 0.0023 * (tMean + 17.8) * Math.sqrt(tempRange) * ra * 0.408;
  return Math.max(0, Number(eto.toFixed(3)));
};

export const dayOfYear = (date: Date): number => {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
};
