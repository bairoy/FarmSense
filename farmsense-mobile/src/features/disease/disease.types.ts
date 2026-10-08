export type DiseaseDiagnosis = {
  disease: string;
  confidence: number;
  margin: number | null;
  probabilities: Record<string, number> | null;
  /** Grad-CAM++ overlay as a data URI: where in the photo the model looked. Null when unavailable. */
  heatmap?: string | null;
};

export type ChemicalTreatment = {
  active_ingredient: string;
  dose_per_hectare: string;
  application: string;
  timing: string;
  preharvest_interval_days: number;
  alternatives?: string[];
};

export type Treatment = {
  disease: string;
  label: string;
  label_ne?: string;
  severity: string;
  pathogen?: string;
  chemical_treatment: ChemicalTreatment | null;
  cultural_practice: string[];
  notes?: string;
};

export type BelowGateGuidance = {
  message: string;
  message_ne?: string;
  actions: string[];
};

export type TwinCorrection = {
  adjusted: boolean;
  date: string;
  simulated_health: number;
  observed_health: number;
  corrected_health: number;
  note: string;
} | null;

export type AnalysisResult = {
  crop_instance_id: string;
  crop_state_id: string | null;
  taken_on: string;
  twin_correction: TwinCorrection;
  diagnosis: DiseaseDiagnosis;
  image_url: string | null;
  health_score: number | null;
  compression: {
    original_bytes: number;
    stored_bytes: number;
    ratio: number | null;
  };
  replayed?: boolean;
} & (
  | { actionable: true; treatment: Treatment | { label: string } }
  | { actionable: false; reason?: string; guidance?: BelowGateGuidance }
);

export type CropImage = {
  id: string;
  crop_instance_id: string;
  crop_state_id: string | null;
  image_url: string;
  r2_key: string | null;
  disease_class: string | null;
  confidence: number | null;
  health_status: string | null;
  treatment_recommended: string | null;
  uploaded_at: string;
};
