export interface Field {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  area: number;
  created_at: string;
}

export interface CreateFieldPayload {
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  area: number;
}
