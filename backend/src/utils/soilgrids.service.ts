/**
 * ISRIC SoilGrids - global soil properties at ~250 m resolution, free, no key.
 *
 * https://rest.isric.org/soilgrids/v2.0/docs
 *
 * Why this replaces the hardcoded constants in the region config: those
 * numbers ("alluvial, TAW 150 mm/m") describe the district as a whole. Two
 * fields three kilometres apart on the Gangetic plain can differ substantially in clay
 * content, and Total Available Water is directly proportional to that. A wrong
 * TAW propagates straight into a wrong irrigation volume.
 *
 * The region file stays as the fallback when SoilGrids is unreachable.
 */

const SOILGRIDS_URL = "https://rest.isric.org/soilgrids/v2.0/properties/query";

export type SoilProfile = {
  source: "soilgrids" | "region_default";
  /** Water held at field capacity, volumetric fraction (m3/m3). */
  fieldCapacity: number;
  /** Water still held at permanent wilting point (m3/m3). */
  wiltingPoint: number;
  /** Total Available Water in mm per metre of soil depth. */
  tawMmPerM: number;
  clayPct?: number;
  sandPct?: number;
  siltPct?: number;
  bulkDensity?: number;
  textureClass?: string;
  fetchedAt: string;
};

/**
 * SoilGrids properties we request, and the depth interval.
 *
 * 0-30cm covers the wheat root zone and most of the rice root zone. Deeper
 * layers matter less because neither crop extracts much water below 60cm in
 * conditions on the eastern Indo-Gangetic plain.
 *
 * Units in the API response are scaled integers - see `unit_measure.d_factor`
 * in the payload. wv0033 (water content at 33 kPa ≈ field capacity) and
 * wv1500 (at 1500 kPa = wilting point) come back as 10x volumetric percent.
 */
const PROPERTIES = ["wv0033", "wv1500", "clay", "sand", "silt", "bdod"];
const DEPTHS = ["0-5cm", "5-15cm", "15-30cm"];

// Soil does not change. Caching in-process avoids hammering a free public API
// on every timeline recompute; a restart is a fine cache lifetime.
const cache = new Map<string, SoilProfile>();

const cacheKey = (lat: number, lon: number) =>
  `${lat.toFixed(3)},${lon.toFixed(3)}`;

/** USDA texture triangle, reduced to the classes that occur on the alluvial plain. */
const classifyTexture = (sand: number, silt: number, clay: number): string => {
  if (clay >= 40) return "clay";
  if (clay >= 27 && sand <= 45) return "clay loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (silt >= 50 && clay < 27) return "silt loam";
  if (sand >= 85) return "sand";
  if (sand >= 70) return "loamy sand";
  if (sand >= 43 && clay < 20) return "sandy loam";
  return "loam";
};

/** Depth-weighted mean of the layer values SoilGrids returns. */
const weightedMean = (layer: any, depths: string[]): number | null => {
  const thickness: Record<string, number> = {
    "0-5cm": 5,
    "5-15cm": 10,
    "15-30cm": 15,
  };

  let weighted = 0;
  let total = 0;

  for (const depth of layer?.depths ?? []) {
    if (!depths.includes(depth.label)) continue;
    const value = depth.values?.mean;
    if (value == null) continue;

    const w = thickness[depth.label] ?? 1;
    weighted += value * w;
    total += w;
  }

  if (total === 0) return null;

  const dFactor = layer?.unit_measure?.d_factor ?? 1;
  return weighted / total / dFactor;
};

export const getSoilProfile = async (
  latitude: number,
  longitude: number,
  fallback: { total_available_water_mm_per_m: number }
): Promise<SoilProfile> => {
  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached) return cached;

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  });
  PROPERTIES.forEach((p) => params.append("property", p));
  DEPTHS.forEach((d) => params.append("depth", d));
  params.append("value", "mean");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const response = await fetch(`${SOILGRIDS_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`SoilGrids returned ${response.status}`);

    const json: any = await response.json();
    const layers: any[] = json?.properties?.layers ?? [];
    const byName = (name: string) => layers.find((l) => l.name === name);

    // wv0033 / wv1500 arrive as volumetric percent; convert to a fraction.
    const fcPct = weightedMean(byName("wv0033"), DEPTHS);
    const pwpPct = weightedMean(byName("wv1500"), DEPTHS);

    if (fcPct == null || pwpPct == null) {
      throw new Error("SoilGrids response missing water-retention layers");
    }

    const fieldCapacity = fcPct / 100;
    const wiltingPoint = pwpPct / 100;

    // TAW = (θ_FC - θ_WP) x 1000 mm per metre of depth. This is the entire
    // point of the call: the size of the bucket the crop can drink from.
    const tawMmPerM = Math.max(30, (fieldCapacity - wiltingPoint) * 1000);

    const clay = weightedMean(byName("clay"), DEPTHS) ?? undefined;
    const sand = weightedMean(byName("sand"), DEPTHS) ?? undefined;
    const silt = weightedMean(byName("silt"), DEPTHS) ?? undefined;

    const profile: SoilProfile = {
      source: "soilgrids",
      fieldCapacity: Number(fieldCapacity.toFixed(4)),
      wiltingPoint: Number(wiltingPoint.toFixed(4)),
      tawMmPerM: Number(tawMmPerM.toFixed(1)),
      clayPct: clay != null ? Number(clay.toFixed(1)) : undefined,
      sandPct: sand != null ? Number(sand.toFixed(1)) : undefined,
      siltPct: silt != null ? Number(silt.toFixed(1)) : undefined,
      bulkDensity: weightedMean(byName("bdod"), DEPTHS) ?? undefined,
      textureClass:
        sand != null && silt != null && clay != null
          ? classifyTexture(sand, silt, clay)
          : undefined,
      fetchedAt: new Date().toISOString(),
    };

    cache.set(key, profile);
    return profile;
  } catch (err) {
    console.warn(
      `SoilGrids unavailable (${(err as Error).message}); using region defaults.`
    );

    // Degrading to district-level constants is acceptable; silently pretending
    // we have field-level soil data would not be. The `source` field travels
    // into the confidence calculation downstream.
    const profile: SoilProfile = {
      source: "region_default",
      fieldCapacity: 0.30,
      wiltingPoint: 0.15,
      tawMmPerM: fallback.total_available_water_mm_per_m,
      fetchedAt: new Date().toISOString(),
    };
    return profile;
  }
};
