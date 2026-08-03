import { differenceInDays } from "date-fns";
import { supabase } from "../../config/supabase.ts";
import { computeCropTimeline, statusFromScore } from "../crop-state/timeline.engine.ts";
import { loadRegionConfig } from "../rules/rules.loader.ts";
import { buildFertilizerPlan } from "./fertilizer.recommender.ts";
import {
  decideUplandIrrigation,
  decidePaddyIrrigation,
  type IrrigationDecision,
} from "./irrigation.recommender.ts";
import { getTreatment } from "../rules/treatments.loader.ts";
import { describeArea } from "../../utils/landUnits.ts";
import { env } from "../../config/env.ts";

/**
 * Normalize crop type to match rate tables and region configs.
 * E.g., "Basmati rice" -> "rice", "Winter wheat" -> "wheat"
 */
const normalizeCropType = (cropType: string): string => {
  const lower = cropType.toLowerCase();
  if (lower.includes("rice")) return "rice";
  if (lower.includes("wheat")) return "wheat";
  return cropType;
};

/**
 * The single canonical crop-state object.
 *
 * Fertilizer, irrigation, disease and the chat agent all read from THIS, and
 * nothing else. Previously each feature computed its own idea of crop health
 * from its own inputs, which meant the dashboard and the chat agent could
 * disagree about the same field on the same day - and neither was obviously
 * wrong, because there was no canonical answer to check against.
 *
 * One object, one health number, one confidence value, one set of derived
 * recommendations.
 */

export type FusedCropState = {
  crop_instance_id: string;
  crop_type: string;
  field: {
    id: string;
    name: string;
    area: ReturnType<typeof describeArea> | null;
    has_boundary: boolean;
  };
  day_number: number;
  phase: string;
  cumulative_gdd: number;
  progress_pct: number;

  health_score: number;
  status: string;
  water_stress: boolean;
  heat_stress: boolean;
  disease_risk: number;

  water: {
    model: "depletion" | "paddy";
    depletion_mm?: number;
    RAW_mm?: number;
    TAW_mm?: number;
    ponded_depth_mm?: number;
    flooded?: boolean;
    dry_days?: number;
  };

  latest_diagnosis: {
    disease: string;
    confidence: number;
    observed_at: string;
    days_ago: number;
    actionable: boolean;
  } | null;

  confidence: Awaited<ReturnType<typeof computeCropTimeline>>["confidence"];
  correction: Awaited<ReturnType<typeof computeCropTimeline>>["correction"];
  soil: Awaited<ReturnType<typeof computeCropTimeline>>["soil"];

  stress_factors: string[];
  recommendations: string[];
};

const loadCrop = async (userId: string, cropId: string) => {
  const { data, error } = await supabase
    .from("crop_instances")
    .select(
      "id,crop_type,sowing_date,status,field_id," +
        "fields!inner(id,user_id,location_name,latitude,longitude,area_sqm,boundary,soil_type)"
    )
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("Crop not found or not owned by this user");
  return data as any;
};

/** Most recent image-based diagnosis, if any. */
const latestDiagnosis = async (cropId: string) => {
  const { data } = await supabase
    .from("crop_images")
    .select("disease_class,confidence,uploaded_at")
    .eq("crop_instance_id", cropId)
    .not("disease_class", "is", null)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  const row = data?.[0] as any;
  if (!row) return null;

  const gate = getTreatment(row.disease_class, row.confidence);

  return {
    disease: row.disease_class,
    confidence: row.confidence,
    observed_at: row.uploaded_at,
    days_ago: differenceInDays(new Date(), new Date(row.uploaded_at)),
    actionable: gate.actionable,
  };
};

export const getFusedCropState = async (
  userId: string,
  cropId: string
): Promise<FusedCropState> => {
  const crop = await loadCrop(userId, cropId);
  const region = loadRegionConfig(env.defaultRegion);
  const cropConfig = region.crops[crop.crop_type] ?? region.crops.rice;

  const [result, diagnosis] = await Promise.all([
    computeCropTimeline(crop),
    latestDiagnosis(cropId),
  ]);

  const today = result.timeline[result.timeline.length - 1];

  // A recent, confident disease finding is direct evidence about the plant,
  // which the weather-driven model has no way to see. It caps the health
  // score rather than replacing it - the model still knows about water and
  // heat stress that the photo does not show.
  let health = today.health_score;
  const extraFactors: string[] = [];

  if (diagnosis && diagnosis.days_ago <= 7 && diagnosis.actionable && diagnosis.disease !== "healthy") {
    const cap = diagnosis.disease === "leaf_blast" ? 50 : 65;
    if (health > cap) {
      health = cap;
      extraFactors.push(
        `${diagnosis.disease.replace("_", " ")} confirmed from a photo ${diagnosis.days_ago} day(s) ago; the health estimate is capped accordingly.`
      );
    }
  }

  return {
    crop_instance_id: cropId,
    crop_type: crop.crop_type,
    field: {
      id: crop.fields.id,
      name: crop.fields.location_name,
      area: crop.fields.area_sqm ? describeArea(crop.fields.area_sqm) : null,
      has_boundary: Boolean(crop.fields.boundary),
    },
    day_number: today.day_number,
    phase: today.phase,
    cumulative_gdd: today.cumulative_gdd,
    progress_pct: Math.min(
      100,
      Math.round((today.cumulative_gdd / (cropConfig.gdd_to_maturity ?? 2000)) * 100)
    ),

    health_score: health,
    // Derived from the CAPPED score, not the rule engine's uncapped one.
    // Reading `today.status` here reported "health 50, status healthy" after a
    // confirmed disease capped the score - an internal contradiction, and
    // precisely what this fusion layer exists to prevent.
    status: statusFromScore(health),
    water_stress: today.water_stress,
    heat_stress: today.heat_stress,
    // A confirmed sighting on the plant cannot leave risk lower than the
    // weather-derived proxy, so take whichever is higher.
    disease_risk: Math.max(
      today.disease_risk,
      diagnosis && diagnosis.days_ago <= 7 && diagnosis.disease !== "healthy"
        ? diagnosis.confidence
        : 0
    ),

    water:
      result.water_model === "paddy"
        ? {
            model: "paddy",
            ponded_depth_mm: today.ponded_depth_mm,
            flooded: today.flooded,
            dry_days: today.dry_days,
          }
        : {
            model: "depletion",
            depletion_mm: today.soil_depletion,
            RAW_mm: today.RAW,
            TAW_mm: today.TAW,
          },

    latest_diagnosis: diagnosis,
    confidence: result.confidence,
    correction: result.correction,
    soil: result.soil,

    stress_factors: [...today.stress_factors, ...extraFactors],
    recommendations: today.recommendations,
  };
};

/**
 * Full advice bundle: one state, three recommendations derived from it.
 *
 * Everything here is traceable to the same fused state, so the irrigation
 * advice and the fertilizer advice cannot contradict each other about whether
 * the crop is water-stressed.
 */
export const getRecommendations = async (userId: string, cropId: string) => {
  const crop = await loadCrop(userId, cropId);
  const state = await getFusedCropState(userId, cropId);
  const region = loadRegionConfig(env.defaultRegion);
  const cropConfig = region.crops[crop.crop_type] ?? region.crops.rice;

  const areaSqm = crop.fields.area_sqm;
  const { latitude, longitude } = crop.fields;

  // Without an area we cannot compute a quantity. Guessing one would produce
  // a confident, specific, wrong number - worse than saying we cannot.
  const canQuantify = typeof areaSqm === "number" && areaSqm > 0;

  const result = await computeCropTimeline(crop);
  const today = result.timeline[result.timeline.length - 1];

  let irrigation: IrrigationDecision | null = null;

  if (canQuantify) {
    irrigation =
      result.water_model === "paddy"
        ? await decidePaddyIrrigation({
            latitude,
            longitude,
            areaSqm,
            state: {
              pondedDepthMm: today.ponded_depth_mm ?? 0,
              soilDepletionMm: today.soil_depletion ?? 0,
              overflowMm: 0,
              percolationMm: 0,
              flooded: today.flooded ?? false,
              dryDays: today.dry_days ?? 0,
            },
            config: {
              bundHeightMm: cropConfig.paddy?.bund_height_mm ?? 150,
              targetDepthMm: cropConfig.paddy?.target_depth_mm ?? 50,
              percolationMmPerDay: cropConfig.paddy?.percolation_mm_per_day ?? 3,
              saturatedBufferMm: cropConfig.paddy?.saturated_buffer_mm ?? 40,
            },
            phase: today.phase,
          })
        : await decideUplandIrrigation({
            latitude,
            longitude,
            areaSqm,
            depletion: today.soil_depletion ?? 0,
            RAW: today.RAW ?? 50,
            TAW: today.TAW ?? 100,
            dailyEtc: today.etc,
            phase: today.phase,
          });
  }

  const fertilizer = canQuantify
    ? buildFertilizerPlan({
        cropType: normalizeCropType(crop.crop_type),
        areaSqm,
        cumulativeGDD: today.cumulative_gdd,
        waterStress: state.water_stress,
        diseaseDetected:
          state.latest_diagnosis?.disease !== undefined &&
          state.latest_diagnosis.disease !== "healthy",
      })
    : null;

  const treatment = state.latest_diagnosis
    ? getTreatment(state.latest_diagnosis.disease, state.latest_diagnosis.confidence)
    : null;

  return {
    state,
    irrigation,
    fertilizer,
    treatment,
    // Repeated at the top level so a client rendering only the recommendation
    // cards cannot show a quantity without the caveat attached to it.
    confidence: state.confidence,
    blocked: canQuantify
      ? null
      : "This field has no recorded area, so water and fertilizer quantities cannot be calculated. Add the field area (in bigha/kattha/dhur) or trace its boundary.",
  };
};
