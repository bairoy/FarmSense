/**
 * Sentinel-1 SAR observation - the rice-season correction channel.
 *
 * Rice in Siraha is transplanted into the monsoon (Jun-Jul). Optical satellites
 * are essentially blind for weeks at a time under monsoon cloud, so Sentinel-2
 * cannot ground the rice model. Radar can: SAR is an active microwave sensor
 * and cloud is transparent at C-band.
 *
 * The signal we exploit is the flooding signature at transplanting:
 *
 *   Standing water is a smooth surface at C-band wavelengths, so it reflects
 *   the radar pulse AWAY from the satellite (specular reflection) instead of
 *   scattering it back. VH backscatter therefore DROPS sharply - typically to
 *   -22 dB or below - the moment the field is puddled and flooded. As the rice
 *   canopy develops, volume scattering from the stems and leaves builds the
 *   signal back up over the following weeks.
 *
 *   Plotted over time this is a distinctive V shape. It is well enough
 *   established that automated rice-mapping methods (e.g. ARM-SARFS) are built
 *   directly around detecting it.
 *
 * What this buys us: an independent, physical confirmation of the actual
 * transplant date. Farmers report sowing dates approximately - "sometime in
 * the second week of Ashadh" - and every downstream GDD and phase calculation
 * is anchored to that date. A two-week error in the anchor is a two-week error
 * in every phase boundary for the whole season.
 *
 * Constellation: Sentinel-1A retired 29 June 2026; S1C + S1D now give a 6-day
 * nominal revisit, so the flooding transition is resolvable to within about a
 * week.
 */

import { runStatisticalRequest } from "./cdse.client.ts";

/**
 * VH (vertical transmit, horizontal receive) is the right polarisation here.
 * Cross-polarised backscatter is generated mainly by volume scattering in the
 * canopy, so it separates "open water" from "developed rice canopy" far more
 * cleanly than co-polarised VV does.
 *
 * Sentinel Hub returns linear power; we convert to dB, the scale every
 * published threshold in the literature is quoted in.
 */
const VH_EVALSCRIPT = `
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VH", "VV", "dataMask"] }],
    output: { bands: 3, sampleType: "FLOAT32" }
  };
}

function toDb(linear) {
  // Floor the input: log10(0) is -Infinity and would poison the polygon mean.
  return 10 * Math.log(Math.max(linear, 1e-6)) / Math.LN10;
}

function evaluatePixel(sample) {
  if (sample.dataMask !== 1) return [0, 0, 0];
  return [toDb(sample.VH), toDb(sample.VV), 1];
}
`;

/** Below this VH backscatter, a pixel is almost certainly open water. */
export const FLOOD_VH_THRESHOLD_DB = -22;

export type Sentinel1Observation = {
  source: "sentinel1";
  date: string;
  vhDb: number;
  vvDb: number;
  /** True when mean VH sits below the open-water threshold. */
  likelyFlooded: boolean;
  usable: boolean;
};

export const fetchBackscatter = async (
  boundary: { type: "Polygon"; coordinates: number[][][] },
  from: string,
  to: string
): Promise<Sentinel1Observation | null> => {
  const values = await runStatisticalRequest({
    geometry: boundary,
    from,
    to,
    collection: "sentinel-1-grd",
    evalscript: VH_EVALSCRIPT,
    extra: {
      acquisitionMode: "IW", // Interferometric Wide - the standard land mode
      polarization: "DV", // dual VV+VH
      // Radiometric terrain correction. The Terai is flat so this changes
      // little here, but leaving it off would make the same field read
      // differently between ascending and descending passes.
      orthorectify: true,
    },
  });

  if (!values || values.length < 3) return null;

  const [vhSum, vvSum, validFraction] = values;
  const usable = validFraction > 0.3;

  const vhDb = usable ? vhSum / validFraction : NaN;

  return {
    source: "sentinel1",
    date: to,
    vhDb: usable ? Number(vhDb.toFixed(2)) : NaN,
    vvDb: usable ? Number((vvSum / validFraction).toFixed(2)) : NaN,
    likelyFlooded: usable && vhDb < FLOOD_VH_THRESHOLD_DB,
    usable,
  };
};

export type TransplantDetection = {
  detected: boolean;
  /** Date of the backscatter minimum - our best estimate of transplanting. */
  transplantDate: string | null;
  minVhDb: number | null;
  /** dB recovered from the minimum, evidence the canopy is developing. */
  recoveryDb: number | null;
  confidence: number;
  explanation: string;
};

/**
 * Detects the V-shaped flooding signature in a VH time series.
 *
 * Three conditions must all hold before we claim a transplant date:
 *
 *   1. A minimum below the open-water threshold  - the field was flooded.
 *   2. A meaningful drop into that minimum       - it was not always wet.
 *   3. A meaningful recovery after it            - a canopy grew.
 *
 * Requiring the recovery is what distinguishes a transplanted paddy from a
 * pond, a flooded road, or a field that simply stayed waterlogged. Without it
 * this detector would happily report any wet surface as a rice crop.
 */
export const detectTransplant = (
  series: Sentinel1Observation[],
  minDropDb = 3,
  minRecoveryDb = 3
): TransplantDetection => {
  const usable = series
    .filter((o) => o.usable && Number.isFinite(o.vhDb))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (usable.length < 4) {
    return {
      detected: false,
      transplantDate: null,
      minVhDb: null,
      recoveryDb: null,
      confidence: 0,
      explanation: `Only ${usable.length} usable Sentinel-1 acquisitions; at least 4 are needed to resolve the V shape.`,
    };
  }

  let minIndex = 0;
  for (let i = 1; i < usable.length; i++) {
    if (usable[i].vhDb < usable[minIndex].vhDb) minIndex = i;
  }

  const minimum = usable[minIndex];

  // The minimum must not sit at either end - a V needs a descent and an ascent
  // that we can actually see.
  if (minIndex === 0 || minIndex === usable.length - 1) {
    return {
      detected: false,
      transplantDate: null,
      minVhDb: minimum.vhDb,
      recoveryDb: null,
      confidence: 0.2,
      explanation:
        "Backscatter minimum falls at the edge of the observation window, so the V shape is not fully captured. Widen the date range.",
    };
  }

  const before = Math.max(...usable.slice(0, minIndex).map((o) => o.vhDb));
  const after = Math.max(...usable.slice(minIndex + 1).map((o) => o.vhDb));

  const drop = before - minimum.vhDb;
  const recovery = after - minimum.vhDb;

  const belowThreshold = minimum.vhDb < FLOOD_VH_THRESHOLD_DB;
  const detected =
    belowThreshold && drop >= minDropDb && recovery >= minRecoveryDb;

  // Confidence blends how deep the minimum went with how clean the V was. A
  // -25 dB minimum with a 6 dB drop and 6 dB recovery is unambiguous; a
  // -22.1 dB minimum with 3 dB either side is a maybe.
  const depthScore = Math.min(1, Math.max(0, (FLOOD_VH_THRESHOLD_DB - minimum.vhDb) / 4 + 0.5));
  const shapeScore = Math.min(1, (drop + recovery) / 12);
  const confidence = detected
    ? Number((0.5 * depthScore + 0.5 * shapeScore).toFixed(2))
    : Number((0.3 * shapeScore).toFixed(2));

  return {
    detected,
    transplantDate: detected ? minimum.date : null,
    minVhDb: minimum.vhDb,
    recoveryDb: Number(recovery.toFixed(2)),
    confidence,
    explanation: detected
      ? `VH backscatter fell to ${minimum.vhDb} dB on ${minimum.date} (${drop.toFixed(1)} dB drop) and recovered ${recovery.toFixed(1)} dB afterwards - the flooding-then-canopy signature of transplanted rice.`
      : `No clear flooding signature. Minimum ${minimum.vhDb} dB (threshold ${FLOOD_VH_THRESHOLD_DB} dB), drop ${drop.toFixed(1)} dB, recovery ${recovery.toFixed(1)} dB.`,
  };
};
