export interface Fertilizer {
  id: string;
  crop_instance_id: string;
  fertilizer_type: string;
  quantity: number;
  action_date?: string;
  created_at: string;
}

export interface CreateFertilizerPayload {
  crop_instance_id: string;
  fertilizer_type: string;
  quantity: number;
  action_date?: string;
}