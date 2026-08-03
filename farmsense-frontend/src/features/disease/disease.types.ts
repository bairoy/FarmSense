export type DiseaseDiagnosis = {
  disease: string;
  confidence: number;
  /** Gap between the top two class probabilities - low means a coin flip. */
  margin: number;
  probabilities: Record<string, number>;
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

/**
 * The analysis response.
 *
 * `actionable` is a discriminant, not a hint. When it is false there is no
 * `treatment` field at all, which makes it impossible for the UI to render a
 * chemical recommendation the backend decided not to stand behind.
 */
export type AnalysisResult = {
  crop_instance_id: string;
  crop_state_id: string | null;
  diagnosis: DiseaseDiagnosis;
  image_url: string | null;
  health_score: number;
  compression: {
    original_bytes: number;
    stored_bytes: number;
    ratio: number | null;
  };
} & (
  | { actionable: true; treatment: Treatment }
  | { actionable: false; reason: string; guidance: BelowGateGuidance }
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
