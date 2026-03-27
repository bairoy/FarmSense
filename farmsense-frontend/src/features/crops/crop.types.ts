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
