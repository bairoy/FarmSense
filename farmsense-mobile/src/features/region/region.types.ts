export interface RegionInfo {
  key: string;
  name: string;
  coordinates: { latitude: number; longitude: number } | null;
  bounds: { north: number; south: number; east: number; west: number } | null;
  land_units: {
    system: string;
    description: string;
    levels: { key: string; label: string; label_local: string; sqm: number }[];
  };
  crops: { key: string; variety: string; season: string; water_model: string }[];
}
