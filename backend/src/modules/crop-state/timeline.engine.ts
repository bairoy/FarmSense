import { differenceInDays, addDays } from "date-fns";
import { supabaseAdmin } from "../../config/supabase.ts";
import { getHistoricalWeather, type WeatherDay } from "../../utils/weather.service.ts";
import { getPowerDaily, type PowerDay } from "../../utils/nasapower.service.ts";
import { getSoilProfile } from "../../utils/soilgrids.service.ts";
import { evaluateAgronomicState } from "../rules/agronomic.engine.ts";
import { loadRegionConfig } from "../rules/rules.loader.ts";
import { calculateEto, calculateEtoHargreaves, dayOfYear } from "../rules/eto.ts";
import {
  soilCapacity,
  currentRootDepth,
  stepWaterBalance,
  type SoilCapacity,
} from "../rules/waterBalance.ts";
import {
  stepPaddy,
  initialPaddyState,
  assessPaddyStress,
  type PaddyState,
  type PaddyConfig,
} from "../rules/paddy.model.ts";
import { observeWheatField, getLatestObservation } from "../satellite/satellite.service.ts";
import { expectedNdvi } from "../satellite/sentinel2.service.ts";
import { assessConfidence, type ConfidenceReport } from "../rules/confidence.ts";
import { env } from "../../config/env.ts";

/**
 * The digital twin core: a predict -> observe -> correct loop.
 *
 * PREDICT   Replay the season day by day from physics. Compute ETo with
 *           Penman-Monteith from real radiation and wind, scale by the crop
 *           coefficient for the current growth phase, and run the appropriate
 *           water model (bucket depletion for wheat, ponded depth for rice).
 *
 * OBSERVE   Pull whatever independent evidence exists - a Sentinel-2 NDVI
 *           reading, a Sentinel-1 flood signature, a farmer check-in.
 *
 * CORRECT   Where an observation disagrees with the simulation, move the
 *           simulation toward the observation and widen the uncertainty band.
 *
 * The old engine only did the first step, with invented constants
 * (`evap = tempMax * 0.2`, a flat `+1.5` daily gain) and no mechanism to ever
 * notice it had drifted. An open-loop simulation run for 120 days is a
 * plausible-looking number with no connection to the field.
 */

export type TimelineDay = {
  date: string;
  day_number: number;
  phase: string;
  cumulative_gdd: number;
  kc: number;
  eto: number;
  etc: number;
  eta: number;
  eto_method: "penman_monteith" | "hargreaves";
  rainfall: number;
  irrigation: number;

  /** Wheat: root-zone depletion in mm. */
  soil_depletion?: number;
  TAW?: number;
  RAW?: number;
  root_depth_m?: number;
  Ks?: number;

  /** Rice: ponded water depth in mm. */
  ponded_depth_mm?: number;
  flooded?: boolean;
  dry_days?: number;

  health_score: number;
  status: string;
  water_stress: boolean;
  heat_stress: boolean;
  disease_risk: number;
  stress_factors: string[];
  recommendations: string[];
};

export type TimelineResult = {
  crop_type: string;
  water_model: "depletion" | "paddy";
  timeline: TimelineDay[];
  soil: Awaited<ReturnType<typeof getSoilProfile>>;
  confidence: ConfidenceReport;
  correction: {
    applied: boolean;
    source: string | null;
    observed_ndvi: number | null;
    expected_ndvi: number | null;
    divergence: number | null;
    note: string | null;
  };
};

const ISO = (d: Date) => d.toISOString().split("T")[0];

/**
 * Merges the two weather sources into the inputs Penman-Monteith needs.
 *
 * NASA POWER is preferred for radiation and 2m wind (it is purpose-built for
 * agro-climatology and gives wind at the height FAO-56 actually wants).
 * Open-Meteo supplies precipitation and temperature, and covers the recent
 * days POWER has not published yet.
 *
 * Returns the ETo plus which method produced it, because a Hargreaves day is
 * a lower-quality day and the confidence report has to know that.
 */
const dailyEto = (
  weather: WeatherDay | undefined,
  power: PowerDay | undefined,
  latitude: number,
  elevationM: number,
  date: Date
): { eto: number; method: "penman_monteith" | "hargreaves" } => {
  const tempMax = weather?.temp_max ?? power?.tempMaxC ?? 30;
  const tempMin = weather?.temp_min ?? power?.tempMinC ?? 20;
  const humidity = weather?.humidity ?? power?.humidityPct ?? 60;

  const radiation = power?.solarRadiationMj ?? weather?.solar_radiation_mj ?? 0;
  const wind = power?.windSpeed2m ?? weather?.wind_speed_10m ?? 0;

  const doy = dayOfYear(date);

  // Full Penman-Monteith needs real radiation. A zero here is a missing
  // measurement, not a genuinely dark day, so fall back rather than compute
  // an ETo we know is wrong.
  if (radiation > 0 && wind > 0) {
    return {
      eto: calculateEto({
        tempMaxC: tempMax,
        tempMinC: tempMin,
        humidityPct: humidity,
        windSpeed2m: wind,
        solarRadiationMj: radiation,
        latitude,
        elevationM,
        dayOfYear: doy,
      }),
      method: "penman_monteith",
    };
  }

  return {
    eto: calculateEtoHargreaves(tempMax, tempMin, latitude, doy),
    method: "hargreaves",
  };
};

export const computeCropTimeline = async (crop: any): Promise<TimelineResult> => {
  const today = new Date();
  const sowingDate = new Date(crop.sowing_date);
  const totalDays = Math.max(1, differenceInDays(today, sowingDate) + 1);

  const field = crop.fields;
  const latitude = field.latitude;
  const longitude = field.longitude;

  const region = loadRegionConfig(env.defaultRegion);
  const cropConfig = region.crops[crop.crop_type] ?? region.crops.rice;
  const elevationM = region.elevation_m ?? 100;
  const isPaddy = cropConfig.water_model === "paddy";

  const startStr = ISO(sowingDate);
  const endStr = today > sowingDate ? ISO(today) : startStr;

  // ---- Gather inputs in parallel; none of them depend on each other -------
  const [weatherMap, powerMap, soil, irrigationRows] = await Promise.all([
    getHistoricalWeather(latitude, longitude, startStr, endStr).catch((err) => {
      console.warn("Weather unavailable:", err.message);
      return new Map<string, WeatherDay>();
    }),
    getPowerDaily(latitude, longitude, startStr, endStr),
    getSoilProfile(latitude, longitude, region.soil),
    // Service-role client, for the same reason as getDaysSinceCheckin below:
    // the engine runs both on the request path and from the check-in
    // scheduler, which has no user session to borrow. Under RLS a sessionless
    // client reads back an empty set rather than erroring, so this query would
    // silently report "no irrigation ever" and the water balance would drift
    // dry with nothing in the logs to say why.
    //
    // Safe because ownership is already settled: the caller resolved `crop`
    // through a user-scoped query before reaching here, and this only reads
    // rows belonging to that crop.
    supabaseAdmin
      .from("irrigation_actions")
      .select("action_date,amount")
      .eq("crop_instance_id", crop.id)
      .then((r) => r.data ?? []),
  ]);

  // Irrigation amounts are now read from the row rather than assumed to be a
  // flat 25mm. A farmer who ran a pump for four hours did not apply the same
  // water as one who ran it for one.
  const irrigationByDate = new Map<string, number>();
  for (const row of irrigationRows as any[]) {
    const key = ISO(new Date(row.action_date));
    irrigationByDate.set(key, (irrigationByDate.get(key) ?? 0) + (row.amount ?? 25));
  }

  // ---- PREDICT -----------------------------------------------------------
  let cumulativeGDD = 0;
  let depletion = 0;
  let paddy: PaddyState = initialPaddyState();
  let penmanDays = 0;

  const paddyConfig: PaddyConfig = {
    bundHeightMm: cropConfig.paddy?.bund_height_mm ?? 150,
    targetDepthMm: cropConfig.paddy?.target_depth_mm ?? 50,
    percolationMmPerDay: cropConfig.paddy?.percolation_mm_per_day ?? 3,
    saturatedBufferMm: cropConfig.paddy?.saturated_buffer_mm ?? 40,
  };

  const timeline: TimelineDay[] = [];

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(sowingDate, i);
    const dateStr = ISO(currentDate);

    const weather = weatherMap.get(dateStr);
    const power = powerMap.get(dateStr);

    const rainfall = weather?.rainfall ?? 0;
    const tempMax = weather?.temp_max ?? power?.tempMaxC ?? 30;
    const tempMin = weather?.temp_min ?? power?.tempMinC ?? 20;
    const humidity = weather?.humidity ?? power?.humidityPct ?? 60;
    const irrigation = irrigationByDate.get(dateStr) ?? 0;

    // --- Phenology: thermal time, not calendar days ---
    const tMean = (tempMax + tempMin) / 2;
    cumulativeGDD += Math.max(0, tMean - cropConfig.base_temperature_c);

    let phase = "maturity";
    let kc = cropConfig.phases[cropConfig.phases.length - 1].kc;

    for (const p of cropConfig.phases) {
      if (cumulativeGDD >= p.gdd_start && cumulativeGDD < p.gdd_end) {
        phase = p.name;
        kc = p.kc;
        break;
      }
    }

    // --- Water demand ---
    const { eto, method } = dailyEto(weather, power, latitude, elevationM, currentDate);
    if (method === "penman_monteith") penmanDays++;

    const etc = Number((eto * kc).toFixed(3));

    const day: TimelineDay = {
      date: dateStr,
      day_number: i + 1,
      phase,
      cumulative_gdd: Math.round(cumulativeGDD),
      kc,
      eto,
      etc,
      eta: etc,
      eto_method: method,
      rainfall: Number(rainfall.toFixed(2)),
      irrigation,
      health_score: 100,
      status: "healthy",
      water_stress: false,
      heat_stress: false,
      disease_risk: 0,
      stress_factors: [],
      recommendations: [],
    };

    let capacity: SoilCapacity | null = null;
    let waterStressSeverity = 0;
    let waterStressReason: string | null = null;

    if (isPaddy) {
      // --- Rice: ponded water depth ---
      paddy = stepPaddy(paddy, etc, rainfall, irrigation, paddyConfig);
      const stress = assessPaddyStress(paddy, phase, paddyConfig);

      day.ponded_depth_mm = paddy.pondedDepthMm;
      day.flooded = paddy.flooded;
      day.dry_days = paddy.dryDays;
      day.soil_depletion = paddy.soilDepletionMm;

      waterStressSeverity = stress.severity;
      waterStressReason = stress.reason;
    } else {
      // --- Wheat: FAO-56 root-zone depletion ---
      const rootDepth = currentRootDepth(
        cumulativeGDD,
        cropConfig.gdd_to_full_root ?? 900,
        cropConfig.root_depth_min_m ?? 0.2,
        cropConfig.root_depth_m
      );

      capacity = soilCapacity(
        soil.tawMmPerM,
        rootDepth,
        cropConfig.depletion_fraction_p,
        etc
      );

      const step = stepWaterBalance(depletion, etc, rainfall, irrigation, capacity);
      depletion = step.depletion;

      day.soil_depletion = step.depletion;
      day.TAW = capacity.TAW;
      day.RAW = capacity.RAW;
      day.root_depth_m = rootDepth;
      day.Ks = step.Ks;
      day.eta = step.ETa;

      if (step.depletion > capacity.RAW) {
        // Severity is how far into the "hard to extract" zone we are, i.e.
        // 0 at RAW and 1 at TAW where the crop can extract nothing.
        waterStressSeverity = Math.min(
          1,
          (step.depletion - capacity.RAW) / Math.max(1, capacity.TAW - capacity.RAW)
        );
        waterStressReason = `Root-zone depletion is ${step.depletion.toFixed(0)} mm against ${capacity.RAW.toFixed(0)} mm of readily available water.`;
      }
    }

    const evaluation = evaluateAgronomicState({
      crop: crop.crop_type,
      phase,
      waterStressSeverity,
      waterStressReason,
      tempMax,
      humidity,
      rainfall,
      isPaddy,
      flooded: day.flooded,
      cropConfig,
    });

    Object.assign(day, evaluation);
    timeline.push(day);
  }

  // ---- OBSERVE + CORRECT -------------------------------------------------
  const correction = await applyCorrection(crop, cropConfig, timeline);

  // ---- Confidence --------------------------------------------------------
  const latest = await getLatestObservation(field.id ?? crop.field_id).catch(() => null);
  const lastCheckin = await getDaysSinceCheckin(crop.id);

  const confidence = assessConfidence({
    daysSinceCorrection: latest
      ? differenceInDays(today, new Date((latest as any).observed_date))
      : null,
    lastCloudFraction: latest ? ((latest as any).cloud_cover_pct ?? 0) / 100 : null,
    soilMeasured: soil.source === "soilgrids",
    weatherCompleteness: totalDays > 0 ? penmanDays / totalDays : 0,
    hasFieldBoundary: Boolean(field.boundary),
    daysSinceFarmerCheckin: lastCheckin,
    observationDisagreed: correction.applied,
  });

  return {
    crop_type: crop.crop_type,
    water_model: isPaddy ? "paddy" : "depletion",
    timeline,
    soil,
    confidence,
    correction,
  };
};

/**
 * The correct step: reconcile the simulated health curve with observed NDVI.
 *
 * The rule is deliberately asymmetric in favour of the satellite. If the model
 * says "healthy" and NDVI says the canopy is thin, the satellite is measuring
 * the actual field and the model is extrapolating from weather. Trusting the
 * model there is how you tell a farmer everything is fine while the crop
 * fails.
 *
 * We nudge rather than overwrite. NDVI has its own error sources - mixed
 * pixels at field edges, residual haze, soil background early in the season -
 * so a single reading should move the estimate, not replace it.
 */
const applyCorrection = async (
  crop: any,
  cropConfig: any,
  timeline: TimelineDay[]
): Promise<TimelineResult["correction"]> => {
  const none = {
    applied: false,
    source: null,
    observed_ndvi: null,
    expected_ndvi: null,
    divergence: null,
    note: null,
  };

  // Optical correction is only meaningful for the dry-season crop. During the
  // rice monsoon, Sentinel-1 handles grounding (transplant date detection), so
  // there is nothing to gain from burning a request on a cloud-covered scene.
  if (cropConfig.satellite_channel !== "sentinel2") {
    return {
      ...none,
      note: "This crop is grounded with Sentinel-1 radar rather than optical NDVI; monsoon cloud makes optical correction unreliable.",
    };
  }

  const fieldId = crop.fields?.id ?? crop.field_id;
  if (!fieldId) return none;

  const observation = await observeWheatField(fieldId).catch(() => null);
  if (!observation?.usable) {
    return {
      ...none,
      note: observation
        ? `Most recent Sentinel-2 pass was ${(observation.cloudFraction * 100).toFixed(0)}% cloud-obscured and could not be used.`
        : "No usable Sentinel-2 observation was available.",
    };
  }

  const last = timeline[timeline.length - 1];
  const progress = last.cumulative_gdd / (cropConfig.gdd_to_maturity ?? 2000);
  const expected = expectedNdvi(progress, crop.crop_type === "wheat" ? "wheat" : "rice");

  const divergence = Number((observation.ndvi - expected).toFixed(4));

  // A gap under 0.10 NDVI is inside the noise of a mixed-pixel field average.
  if (Math.abs(divergence) < 0.1) {
    return {
      applied: false,
      source: "sentinel2",
      observed_ndvi: observation.ndvi,
      expected_ndvi: Number(expected.toFixed(4)),
      divergence,
      note: "Observed NDVI agrees with the simulation.",
    };
  }

  // Map the NDVI gap onto the health scale. 0.3 NDVI below expectation is a
  // seriously underperforming canopy, so that anchors the full 40-point pull.
  const healthAdjustment = Math.max(-40, Math.min(15, (divergence / 0.3) * 40));

  // Correct the recent tail only. The simulation was probably right earlier in
  // the season; back-propagating today's evidence across 90 past days would
  // rewrite history we have no evidence about.
  const correctionWindow = Math.min(14, timeline.length);
  for (let i = timeline.length - correctionWindow; i < timeline.length; i++) {
    // Ramp the correction in, so the strongest pull lands on today.
    const weight = (i - (timeline.length - correctionWindow) + 1) / correctionWindow;
    const day = timeline[i];

    day.health_score = Math.max(
      0,
      Math.min(100, Math.round(day.health_score + healthAdjustment * weight))
    );
    day.status = statusFromScore(day.health_score);
  }

  const note =
    divergence < 0
      ? `Observed canopy vigour (NDVI ${observation.ndvi}) is below what the weather-driven simulation predicted (${expected.toFixed(2)}). The satellite measures the actual field, so the health estimate has been reduced and confidence lowered. Inspect the crop for a cause the weather model cannot see - nutrient deficiency, pest damage, or waterlogging.`
      : `Observed canopy vigour (NDVI ${observation.ndvi}) exceeds the simulation's prediction (${expected.toFixed(2)}). The crop is doing better than the weather alone would suggest.`;

  last.recommendations.push(note);

  return {
    applied: true,
    source: "sentinel2",
    observed_ndvi: observation.ndvi,
    expected_ndvi: Number(expected.toFixed(4)),
    divergence,
    note,
  };
};

export const statusFromScore = (score: number): string =>
  score > 85
    ? "healthy"
    : score > 65
      ? "mild_stress"
      : score > 40
        ? "moderate_stress"
        : "critical";

const getDaysSinceCheckin = async (cropId: string): Promise<number | null> => {
  // Service-role client: `farmer_checkins` is RLS-protected and the anon client
  // reads back an empty set rather than erroring, which would silently make
  // every crop look like it had never been checked in on - quietly docking
  // confidence for a reason that is not true.
  const { data } = await supabaseAdmin
    .from("farmer_checkins")
    .select("responded_at")
    .eq("crop_instance_id", cropId)
    .not("responded_at", "is", null)
    .order("responded_at", { ascending: false })
    .limit(1);

  const row = data?.[0] as any;
  return row ? differenceInDays(new Date(), new Date(row.responded_at)) : null;
};
