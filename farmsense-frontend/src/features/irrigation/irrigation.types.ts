export interface Irrigation {
  id: string;
  crop_instance_id: string;
  amount: number;
  action_date?: string;
  created_at: string;
}

export interface CreateIrrigationPayload {
  crop_instance_id: string;
  amount: number;
  action_date?: string;
}