import { api } from "../../services/api";
import type { Confidence } from "../../components/ConfidenceBadge";

export type IrrigationDecision = {
  action: "irrigate_now" | "wait_for_rain" | "no_action_needed" | "drain";
  urgency: "critical" | "high" | "moderate" | "none";
  reason: string;
  dosage: {
    depth_mm: number;
    volume_litres: number;
    volume_m3: number;
    pump_hours_estimate: number | null;
  } | null;
  forecast: {
    expected_rain_mm_7d: number;
    first_meaningful_rain: { date: string; mm: number } | null;
    days_until_critical: number | null;
    forecast_trusted: boolean;
  };
  caveats: string[];
};

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
  area: { area_label: string; hectares: number; area_sqm: number };
  season_total_kg: { N: number; P2O5: number; K2O: number };
  organic_recommendation: string;
  micronutrient_recommendation: string | null;
  splits: FertilizerSplit[];
  current_action: FertilizerSplit | null;
  adjustments: { applied: string; reason: string; multiplier: number }[];
  caveats: string[];
};

export type FusedCropState = {
  crop_instance_id: string;
  crop_type: string;
  field: {
    id: string;
    name: string;
    area: { area_label: string; hectares: number } | null;
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
    days_ago: number;
    actionable: boolean;
  } | null;
  confidence: Confidence;
  correction: {
    applied: boolean;
    source: string | null;
    observed_ndvi: number | null;
    expected_ndvi: number | null;
    note: string | null;
  };
  soil: { source: string; tawMmPerM: number; textureClass?: string };
  stress_factors: string[];
  recommendations: string[];
};

export type RecommendationBundle = {
  state: FusedCropState;
  irrigation: IrrigationDecision | null;
  fertilizer: FertilizerPlan | null;
  confidence: Confidence;
  /** Non-null when quantities cannot be computed (usually a missing field area). */
  blocked: string | null;
};

/**
 * One request for everything.
 *
 * Preferred over the individual endpoints because every part of the response
 * is derived from the same fused state - so the irrigation card and the
 * fertilizer card cannot disagree about whether the crop is water-stressed.
 */
export const getRecommendations = async (
  cropId: string
): Promise<RecommendationBundle> => {
  const { data } = await api.get<RecommendationBundle>(`/recommendations/${cropId}`);
  return data;
};

export const getCropState = async (cropId: string): Promise<FusedCropState> => {
  const { data } = await api.get<FusedCropState>(`/recommendations/${cropId}/state`);
  return data;
};

export type CheckinQuestion = {
  id: string;
  question_text: string;
  question: {
    key: string;
    question: string;
    question_ne: string;
    options: { value: string; label: string; label_ne: string }[];
  };
};

export const getDueCheckin = async (cropId: string) => {
  const { data } = await api.get<{ due: boolean; checkin: CheckinQuestion | null }>(
    `/checkins/crop/${cropId}/due`
  );
  return data;
};

export const answerCheckin = async (checkinId: string, answer: string) => {
  const { data } = await api.post(`/checkins/${checkinId}/answer`, { answer });
  return data;
};
