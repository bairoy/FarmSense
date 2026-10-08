export type AreaDescription = {
  area_sqm: number;
  hectares: number;
  acres: number;
  unit_system: string;
  units: Record<string, number>;
  area_label: string;
};

export interface Field {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  boundary: { type: "Polygon"; coordinates: number[][][] } | null;
  area_sqm: number | null;
  area_source: "boundary" | "area_sqm" | "local_units" | "legacy_acres" | null;
  area: AreaDescription | null;
  created_at: string;
}

export interface CreateFieldPayload {
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  area_sqm?: number;
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  [unit: string]: unknown;
}
