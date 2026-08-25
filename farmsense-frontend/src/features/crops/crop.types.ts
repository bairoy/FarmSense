export interface Crop {
  id: string;
  field_id: string;
  crop_type: string;
  sowing_date: string;
  irrigation_method?: string | null;
  status: string;
  created_at: string;
}

export interface CreateCropPayload {
  field_id: string;
  crop_type: string;
  sowing_date: string;
  irrigation_method?: string;
  status: string;
}

export interface UpdateCropPayload {
  sowing_date?: string;
  irrigation_method?: string;
  status?: string;
}

/**
 * One simulated day from `GET /api/crop-states/timeline/:cropId`.
 *
 * Mirrors `TimelineDay` in the backend's timeline engine. The two water models
 * emit different state variables - wheat reports root-zone depletion against
 * TAW/RAW, rice reports ponded depth - so those fields are optional and only
 * one group is present for a given crop. The chart picks which to plot from
 * the `water_model` the same endpoint returns.
 */
export interface TimelineDay {
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

  /** Wheat (depletion model). */
  soil_depletion?: number;
  TAW?: number;
  RAW?: number;
  root_depth_m?: number;
  Ks?: number;

  /** Rice (paddy model). */
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
}
