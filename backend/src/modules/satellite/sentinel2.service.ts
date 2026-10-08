/**
 * Sentinel-2 optical observation - the wheat-season correction channel.
 *
 * Wheat in Gorakhpur grows Nov-Apr, the dry rabi winter. Skies are mostly clear, so
 * optical works well and NDVI is a genuine independent measurement of canopy
 * vigour. During the rice monsoon it is largely useless (see
 * sentinel1.service.ts for that season).
 *
 * Indices computed:
 *   NDVI = (NIR - Red) / (NIR + Red)      canopy greenness / biomass
 *   NDWI = (NIR - SWIR) / (NIR + SWIR)    canopy water content
 *
 * NDWI is included because it responds to water stress days before NDVI does.
 * A crop closes its stomata and loses leaf water content well before it starts
 * visibly yellowing, so NDWI is the earlier warning.
 */

import { runStatisticalRequest } from "./cdse.client.ts";

/**
 * The evalscript runs on Sentinel Hub's servers, once per pixel.
 *
 * SCL (Scene Classification Layer) is band 12 of L2A. We use it to reject
 * cloud, cloud shadow and snow pixels: averaging a cloud into the field mean
 * produces a nonsense NDVI that looks like a sudden crop collapse, which is
 * exactly the false alarm this system must not generate.
 *
 * SCL classes kept: 4 (vegetation), 5 (bare soil), 6 (water), 7 (unclassified).
 * Rejected: 3 (shadow), 8/9/10 (cloud medium/high/cirrus), 11 (snow).
 */
const NDVI_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "B11", "SCL", "dataMask"] }],
    output: [
      { id: "default", bands: 2 },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(sample) {
  const badScl = [3, 8, 9, 10, 11];
  const isValid = sample.dataMask === 1 && badScl.indexOf(sample.SCL) < 0;

  const ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  const ndwi = (sample.B08 - sample.B11) / (sample.B08 + sample.B11);

  // dataMask = 0 removes cloudy pixels from the polygon mean; the Statistical
  // API reports how many were removed, which becomes cloudFraction below.
  return { default: [ndvi, ndwi], dataMask: [isValid ? 1 : 0] };
}
`;

export type Sentinel2Observation = {
  source: "sentinel2";
  date: string;
  ndvi: number;
  ndwi: number;
  /** Share of pixels rejected by the cloud mask, 0-1. */
  cloudFraction: number;
  usable: boolean;
};

export const fetchNdvi = async (
  boundary: { type: "Polygon"; coordinates: number[][][] },
  from: string,
  to: string,
  maxCloudCoverPct = 60
): Promise<Sentinel2Observation | null> => {
  const result = await runStatisticalRequest({
    geometry: boundary,
    from,
    to,
    collection: "sentinel-2-l2a",
    evalscript: NDVI_EVALSCRIPT,
    extra: {
      maxCloudCoverage: maxCloudCoverPct,
      mosaickingOrder: "leastCC", // prefer the least-cloudy scene in the window
    },
  });

  if (!result) return null;

  const [ndvi, ndwi] = result.means;

  // If almost every pixel was masked out, the mean is meaningless. Returning
  // an unusable observation (rather than null) is deliberate: the fusion step
  // needs to know we tried and failed, so it can widen uncertainty instead of
  // assuming no news is good news.
  const usable = result.validFraction > 0.3;

  return {
    source: "sentinel2",
    date: result.date,
    ndvi: usable ? Number(ndvi.toFixed(4)) : NaN,
    ndwi: usable ? Number(ndwi.toFixed(4)) : NaN,
    cloudFraction: Number((1 - result.validFraction).toFixed(3)),
    usable,
  };
};

/**
 * Expected NDVI for a healthy crop at a given point in its cycle.
 *
 * The classic crop NDVI curve: low at emergence (mostly bare soil in the
 * pixel), rising through canopy closure, plateauing at peak vegetative growth,
 * then falling through senescence as the crop dries down for harvest.
 *
 * This is the reference the simulation is compared against. A model that says
 * "healthy" while observed NDVI sits well below this curve is a model that has
 * drifted, and the satellite wins.
 */
export const expectedNdvi = (
  progressFraction: number,
  crop: "wheat" | "rice"
): number => {
  const f = Math.max(0, Math.min(1, progressFraction));

  // Peak NDVI differs by crop: a flooded paddy canopy over standing water
  // reads slightly lower than a dense wheat canopy over dry soil, because the
  // water background depresses the NIR response.
  const peak = crop === "wheat" ? 0.85 : 0.78;
  const bare = 0.15;

  if (f < 0.25) {
    // Emergence to canopy closure
    return bare + (peak - bare) * (f / 0.25) * 0.7;
  }
  if (f < 0.6) {
    // Peak vegetative plateau
    return bare + (peak - bare) * (0.7 + 0.3 * ((f - 0.25) / 0.35));
  }
  // Senescence
  return peak - (peak - 0.25) * ((f - 0.6) / 0.4);
};
