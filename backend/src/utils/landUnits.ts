/**
 * Nepali Terai land measurement.
 *
 * Farmers in Siraha do not think in hectares. They think in Bigha-Kattha-Dhur,
 * the customary system used across the Terai. Asking a farmer for "4.5 acres"
 * gets a guess; asking for "2 bigha 5 kattha" gets the number written on their
 * land certificate.
 *
 * Internally everything is square metres. Conversion happens only at the edges
 * (input parsing and display formatting) so no calculation ever depends on
 * which unit the farmer happened to use.
 *
 * The constants are exact by definition of the system:
 *   1 Bigha  = 20 Kattha
 *   1 Kattha = 20 Dhur
 *   1 Dhur   = 16.93 m2
 *
 * Everything else follows by multiplication. Do not "simplify" these into
 * rounded values - a fertilizer dose is computed from this number, and a 2%
 * area error is a 2% chemical error across a whole field.
 */

export const SQM_PER_DHUR = 16.93;
export const SQM_PER_KATTHA = SQM_PER_DHUR * 20; // 338.60
export const SQM_PER_BIGHA = SQM_PER_KATTHA * 20; // 6772.00

export const SQM_PER_HECTARE = 10_000;
export const SQM_PER_ACRE = 4046.8564224;

export type BighaKatthaDhur = {
  bigha: number;
  kattha: number;
  dhur: number;
};

/** Bigha-Kattha-Dhur -> square metres. This is the canonical direction. */
export const toSquareMetres = (input: Partial<BighaKatthaDhur>): number => {
  const bigha = input.bigha ?? 0;
  const kattha = input.kattha ?? 0;
  const dhur = input.dhur ?? 0;

  if (bigha < 0 || kattha < 0 || dhur < 0) {
    throw new Error("Land area components cannot be negative");
  }

  return bigha * SQM_PER_BIGHA + kattha * SQM_PER_KATTHA + dhur * SQM_PER_DHUR;
};

/**
 * Square metres -> Bigha-Kattha-Dhur.
 *
 * Dhur keeps two decimals rather than rounding to a whole unit: a Dhur is only
 * ~17 m2, and silently rounding it away would make round-tripping a value
 * lossy in a way farmers would notice on small plots.
 */
export const fromSquareMetres = (sqm: number): BighaKatthaDhur => {
  if (sqm < 0) throw new Error("Area cannot be negative");

  const bigha = Math.floor(sqm / SQM_PER_BIGHA);
  let remainder = sqm - bigha * SQM_PER_BIGHA;

  const kattha = Math.floor(remainder / SQM_PER_KATTHA);
  remainder -= kattha * SQM_PER_KATTHA;

  const dhur = Number((remainder / SQM_PER_DHUR).toFixed(2));

  return { bigha, kattha, dhur };
};

export const sqmToHectares = (sqm: number): number => sqm / SQM_PER_HECTARE;
export const hectaresToSqm = (ha: number): number => ha * SQM_PER_HECTARE;
export const sqmToAcres = (sqm: number): number => sqm / SQM_PER_ACRE;
export const acresToSqm = (acres: number): number => acres * SQM_PER_ACRE;

/** Human-readable Nepali-unit string, omitting zero components. */
export const formatNepaliArea = (sqm: number): string => {
  const { bigha, kattha, dhur } = fromSquareMetres(sqm);

  const parts: string[] = [];
  if (bigha > 0) parts.push(`${bigha} bigha`);
  if (kattha > 0) parts.push(`${kattha} kattha`);
  if (dhur > 0) parts.push(`${dhur} dhur`);

  // A plot smaller than one Dhur still deserves an honest answer.
  return parts.length > 0 ? parts.join(" ") : `${dhur} dhur`;
};

/**
 * Everything the UI and the recommendation engine need, from one number.
 *
 * Recommendations are published per hectare (NARC rate tables, FAO-56), while
 * farmers speak Bigha-Kattha-Dhur. Returning both from one place means the
 * conversion is never re-implemented at a call site.
 */
export const describeArea = (sqm: number) => ({
  area_sqm: Number(sqm.toFixed(2)),
  hectares: Number(sqmToHectares(sqm).toFixed(4)),
  acres: Number(sqmToAcres(sqm).toFixed(4)),
  nepali: fromSquareMetres(sqm),
  nepali_label: formatNepaliArea(sqm),
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
