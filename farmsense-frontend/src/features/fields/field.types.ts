export type AreaDescription = {
  area_sqm: number;
  hectares: number;
  acres: number;
  /** Which customary system the units below belong to, e.g. "bigha-katha-dhur". */
  unit_system: string;
  /** One entry per unit in the region's ladder, keyed by unit name. */
  units: Record<string, number>;
  /** Pre-formatted for display, e.g. "2 bigha 5 katha". */
  area_label: string;
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
  area_source: "boundary" | "area_sqm" | "local_units" | "legacy_acres" | null;
  /** Every unit representation, computed server-side so the UI never converts. */
  area: AreaDescription | null;
  created_at: string;
}

export interface CreateFieldPayload {
  location_name: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  /**
   * Supply either the region's customary unit components (keyed by unit name,
   * e.g. bigha/katha/dhur), an area_sqm, or a boundary polygon.
   */
  area_sqm?: number;
  boundary?: { type: "Polygon"; coordinates: number[][][] };
  [unit: string]: unknown;
}
