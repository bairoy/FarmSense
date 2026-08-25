/**
 * Customary land measurement, driven by the active region config.
 *
 * Farmers do not think in hectares. In Gorakhpur they think in Bigha-Katha-Dhur,
 * the revenue units written on their khatauni. Asking for "1.5 acres" gets a
 * guess; asking for "2 bigha 5 katha" gets the number off the document.
 *
 * Nothing about a specific place is hardcoded here. The unit ladder comes from
 * `regions/<DEFAULT_REGION>.json` under `land_units`, because the same word
 * means different areas in different districts - a UP pucca bigha is 2529 m2
 * while a Nepal Terai bigha is 6772 m2, and silently applying one where the
 * other is meant is a 2.7x error in every fertilizer dose the system produces.
 *
 * Internally everything is square metres. Conversion happens only at the edges
 * (input parsing and display formatting) so no calculation ever depends on
 * which unit the farmer happened to use.
 *
 * Read straight from process.env rather than through config/env.ts: that module
 * throws on a missing Supabase key, and the unit maths must stay importable by
 * a unit test with no environment at all.
 */

import { loadActiveRegion } from "../modules/rules/rules.loader.ts";

export type LandUnitLevel = {
  /** Machine key, and the field name accepted by the API. */
  key: string;
  label: string;
  /** Same label in the local script, for the UI to show alongside. */
  label_local: string;
  sqm: number;
};

export type LandUnitSystem = {
  system: string;
  description: string;
  source: string;
  levels: LandUnitLevel[];
};

const region = loadActiveRegion();

if (!region.land_units?.levels?.length) {
  throw new Error(
    `Region "${region.region}" has no land_units.levels. Every region config must declare its own unit ladder.`
  );
}

/**
 * Largest unit first. The ladder is sorted here rather than trusted from the
 * JSON so that `fromSquareMetres` can peel units off in order regardless of
 * how a future region file happens to list them.
 */
export const LAND_UNITS: LandUnitSystem = {
  ...region.land_units,
  levels: [...region.land_units.levels].sort(
    (a: LandUnitLevel, b: LandUnitLevel) => b.sqm - a.sqm
  ),
};

/** The smallest unit in the ladder - what a leftover remainder is expressed in. */
const SMALLEST = LAND_UNITS.levels[LAND_UNITS.levels.length - 1];

export const UNIT_KEYS = LAND_UNITS.levels.map((l) => l.key);

export const SQM_PER_HECTARE = 10_000;
export const SQM_PER_ACRE = 4046.8564224;

/** Area expressed as a whole number of each customary unit. */
export type LocalArea = Record<string, number>;

export const sqmPerUnit = (key: string): number => {
  const level = LAND_UNITS.levels.find((l) => l.key === key);
  if (!level) {
    throw new Error(
      `Unknown land unit "${key}" for region "${region.region}". Valid units: ${UNIT_KEYS.join(", ")}`
    );
  }
  return level.sqm;
};

/** Customary units -> square metres. This is the canonical direction. */
export const toSquareMetres = (input: Partial<LocalArea>): number => {
  let total = 0;

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (value < 0) {
      throw new Error("Land area components cannot be negative");
    }
    total += value * sqmPerUnit(key);
  }

  return total;
};

/**
 * Square metres -> customary units.
 *
 * The smallest unit keeps two decimals rather than rounding to a whole unit: a
 * dhur is only ~6 m2, and silently rounding it away would make round-tripping
 * a value lossy in a way farmers would notice on small plots.
 *
 * The maths runs in whole counts of the smallest unit rather than subtracting
 * square metres level by level. Doing it in metres accumulates binary rounding
 * error: `2 bigha 5 katha` is 5690.891844 m2, but peeling 2 bigha off that
 * leaves 632.3213159999996, which divides into 4.9999999999999964 katha and
 * floors to 4 - so the farmer typed "2 bigha 5 katha" and was shown
 * "2 bigha 4 katha 20 dhur" for the very same area.
 */
export const fromSquareMetres = (sqm: number): LocalArea => {
  if (sqm < 0) throw new Error("Area cannot be negative");

  const out: LocalArea = {};
  let remainder = Number((sqm / SMALLEST.sqm).toFixed(2));

  for (const level of LAND_UNITS.levels) {
    if (level.key === SMALLEST.key) break;
    // How many of the smallest unit make up one of this level (katha -> 20).
    const perLevel = level.sqm / SMALLEST.sqm;
    // The epsilon absorbs the last bit of drift in `perLevel` itself. A real
    // traced boundary never lands within 1e-9 of a unit boundary by accident;
    // only the exact-arithmetic case above does.
    const whole = Math.floor(remainder / perLevel + 1e-9);
    out[level.key] = whole;
    remainder -= whole * perLevel;
  }

  out[SMALLEST.key] = Number(remainder.toFixed(2));
  return out;
};

export const sqmToHectares = (sqm: number): number => sqm / SQM_PER_HECTARE;
export const hectaresToSqm = (ha: number): number => ha * SQM_PER_HECTARE;
export const sqmToAcres = (sqm: number): number => sqm / SQM_PER_ACRE;
export const acresToSqm = (acres: number): number => acres * SQM_PER_ACRE;

/** Human-readable customary-unit string, omitting zero components. */
export const formatLocalArea = (sqm: number): string => {
  const parts: string[] = [];
  const area = fromSquareMetres(sqm);

  for (const level of LAND_UNITS.levels) {
    const value = area[level.key];
    if (value > 0) parts.push(`${value} ${level.key}`);
  }

  // A plot smaller than the smallest unit still deserves an honest answer.
  return parts.length > 0
    ? parts.join(" ")
    : `${area[SMALLEST.key]} ${SMALLEST.key}`;
};

/**
 * Everything the UI and the recommendation engine need, from one number.
 *
 * Recommendations are published per hectare (ICAR rate tables, FAO-56), while
 * farmers speak in customary units. Returning both from one place means the
 * conversion is never re-implemented at a call site.
 */
export const describeArea = (sqm: number) => ({
  area_sqm: Number(sqm.toFixed(2)),
  hectares: Number(sqmToHectares(sqm).toFixed(4)),
  acres: Number(sqmToAcres(sqm).toFixed(4)),
  unit_system: LAND_UNITS.system,
  units: fromSquareMetres(sqm),
  area_label: formatLocalArea(sqm),
});

/**
 * Area of a GeoJSON-style polygon ring given in [lon, lat] degrees.
 *
 * Uses an equirectangular projection about the ring's own mean latitude, then
 * the shoelace formula. Over a field of a few hundred metres the projection
 * error is far below the error in the farmer's traced boundary, and this
 * avoids pulling in a geodesy dependency for a district-scale MVP.
 */
export const polygonAreaSqm = (ring: [number, number][]): number => {
  if (ring.length < 3) return 0;

  const points = [...ring];
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    points.pop(); // drop the repeated closing vertex
  }
  if (points.length < 3) return 0;

  const EARTH_RADIUS_M = 6_378_137;
  const meanLatRad =
    (points.reduce((sum, [, lat]) => sum + lat, 0) / points.length) *
    (Math.PI / 180);

  const metresPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const metresPerDegLon = metresPerDegLat * Math.cos(meanLatRad);

  const projected = points.map(([lon, lat]) => [
    lon * metresPerDegLon,
    lat * metresPerDegLat,
  ]);

  let twiceArea = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    twiceArea += x1 * y2 - x2 * y1;
  }

  // Absolute value: a ring traced clockwise is the same field as one traced
  // counter-clockwise, and farmers will do both.
  return Math.abs(twiceArea / 2);
};

/** Centroid of a ring, used when we need a single representative point. */
export const polygonCentroid = (
  ring: [number, number][]
): { longitude: number; latitude: number } => {
  const points = ring.slice();
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && first[0] === last[0] && first[1] === last[1]) {
    points.pop();
  }

  const n = points.length || 1;
  return {
    longitude: points.reduce((s, p) => s + p[0], 0) / n,
    latitude: points.reduce((s, p) => s + p[1], 0) / n,
  };
};
