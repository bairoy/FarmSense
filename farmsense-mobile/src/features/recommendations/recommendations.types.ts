export type AreaDescription = {
  area_sqm: number;
  hectares: number;
  acres: number;
  unit_system: string;
  units: Record<string, number>;
  area_label: string;
};

export type FusedCropState = {
  crop_instance_id: string;
  crop_type: string;
  field: {
    id: string;
    name: string;
    area: AreaDescription | null;
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

  confidence: {
    score: number;
    caveat: string;
    [key: string]: unknown;
  };

  stress_factors: string[];
  recommendations: string[];
};

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
  area: AreaDescription;
  season_total_kg: { N: number; P2O5: number; K2O: number };
  organic_recommendation: string;
  micronutrient_recommendation: string | null;
  splits: FertilizerSplit[];
  current_action: FertilizerSplit | null;
  adjustments: { applied: string; reason: string; multiplier: number }[];
  caveats: string[];
};

export type RecommendationsBundle = {
  state: FusedCropState;
  irrigation: IrrigationDecision | null;
  fertilizer: FertilizerPlan | null;
  treatment: unknown;
  confidence: FusedCropState["confidence"];
  blocked: string | null;
};
