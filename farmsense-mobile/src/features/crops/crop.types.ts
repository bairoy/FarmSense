export interface CropInstance {
  id: string;
  field_id: string;
  crop_type: string;
  sowing_date: string;
  irrigation_method: string | null;
  status: "active" | "harvested" | "failed";
  created_at: string;
}

export interface CreateCropPayload {
  field_id: string;
  crop_type: string;
  sowing_date: string;
  irrigation_method?: string;
  status?: "active" | "harvested" | "failed";
}
