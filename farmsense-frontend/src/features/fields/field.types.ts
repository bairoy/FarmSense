export type AreaDescription = {
  area_sqm: number;
  hectares: number;
  acres: number;
  nepali: { bigha: number; kattha: number; dhur: number };
  nepali_label: string;
};

export interface Field {
  id: string;
  user_id: string;
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  /** GeoJSON Polygon. Null until the farmer traces a boundary. */
  boundary: { type: "Polygon"; coordinates: number[][][] } | null;
  /** Canonical area in square metres. Everything downstream computes from this. */
  area_sqm: number | null;
  area_source: "boundary" | "area_sqm" | "nepali_units" | "legacy_acres" | null;
  /** Every unit representation, computed server-side so the UI never converts. */
  area: AreaDescription | null;
  created_at: string;
}

export interface CreateFieldPayload {
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  /** Supply either the Nepali components, an area_sqm, or a boundary polygon. */
  bigha?: number;
  kattha?: number;
  dhur?: number;
  area_sqm?: number;
  boundary?: { type: "Polygon"; coordinates: number[][][] };
}
