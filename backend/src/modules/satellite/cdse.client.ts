/**
 * Copernicus Data Space Ecosystem (CDSE) - the official free ESA source for
 * Sentinel data.
 *
 * Deliberately NOT Google Earth Engine. GEE's free tier is restricted to
 * research and nonprofit use; any operational or commercial use requires a
 * paid commercial licence. FarmSense is a product, so building on the GEE free
 * tier would mean building on a licence we are not entitled to.
 *
 * CDSE gives us:
 *   - Sentinel-2 optical (10 m, ~5 day revisit) for NDVI/NDWI
 *   - Sentinel-1 SAR (10 m, 6 day revisit) which sees through monsoon cloud
 *
 * Constellation note: Sentinel-1A was retired on 29 June 2026. The operational
 * constellation is now Sentinel-1C + Sentinel-1D, giving a 6-day nominal
 * revisit. Correction cadence is planned around that, not around the old
 * 12-day single-satellite figure.
 *
 * Auth is OAuth2 client credentials against the CDSE identity service.
 */

import { env, isCdseConfigured } from "../../config/env.ts";

const TOKEN_URL =
  "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STATISTICS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

type CachedToken = { token: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

export const getAccessToken = async (): Promise<string> => {
  if (!isCdseConfigured()) {
    throw new Error(
      "CDSE is not configured. Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET " +
        "(register a free account at dataspace.copernicus.eu)."
    );
  }

  // Refresh 60s early so a token never expires mid-request.
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.cdseClientId,
    client_secret: env.cdseClientSecret,
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(`CDSE token request failed: ${response.status}`);
  }

  const json: any = await response.json();
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };

  return cachedToken.token;
};

export type ProcessRequest = {
  geometry: { type: "Polygon"; coordinates: number[][][] };
  from: string;
  to: string;
  collection: "sentinel-2-l2a" | "sentinel-1-grd";
  evalscript: string;
  /** dataFilter fields (cloud cover, acquisition mode, ...). */
  extra?: Record<string, unknown>;
  /** Sentinel Hub processing options (orthorectification, DEM, ...). */
  processing?: Record<string, unknown>;
};

export type StatisticalResult = {
  /** Field mean of each output band, over valid pixels only. */
  means: number[];
  /** Share of the field's pixels that passed the evalscript's data mask, 0-1. */
  validFraction: number;
  /** Start date (YYYY-MM-DD) of the daily interval the values come from. */
  date: string;
};

const MAX_RETRIES = 4;

/** ~10 m in degrees; the polygon is sent in EPSG:4326. */
const RESOLUTION_DEG = 0.0001;

/**
 * Runs an evalscript over a field boundary through the Sentinel Hub
 * Statistical API and returns the field mean of each output band.
 *
 * The Statistical API averages every pixel inside the polygon server-side, so
 * we transfer a handful of numbers instead of an image. The evalscript marks
 * cloud / no-data pixels with `dataMask = 0`; those are excluded from the mean
 * and reported through `validFraction`.
 *
 * Returns the most recent daily interval that has at least one valid pixel, or
 * null when there was no usable acquisition in the window (404, or every
 * interval fully masked). Any other failure throws - a malformed request must
 * never be mistaken for "no data".
 */
export const runStatisticalRequest = async (
  request: ProcessRequest
): Promise<StatisticalResult | null> => {
  const token = await getAccessToken();

  const payload = {
    input: {
      bounds: {
        geometry: request.geometry,
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" },
      },
      data: [
        {
          type: request.collection,
          dataFilter: request.extra ?? {},
          ...(request.processing ? { processing: request.processing } : {}),
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${request.from}T00:00:00Z`,
        to: `${request.to}T23:59:59Z`,
      },
      aggregationInterval: { of: "P1D" },
      evalscript: request.evalscript,
      resx: RESOLUTION_DEG,
      resy: RESOLUTION_DEG,
    },
  };

  // CDSE rate-limits bursts with HTTP 429. That is transient, not "no data":
  // wait and retry with exponential backoff rather than reporting a failure.
  let response!: Response;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    response = await fetch(STATISTICS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (response.status !== 429 || attempt === MAX_RETRIES) break;

    const retryAfter = Number(response.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(
      `CDSE statistics request failed: ${response.status} ${await response.text()}`
    );
  }

  const json: any = await response.json();
  const intervals: any[] = Array.isArray(json?.data) ? json.data : [];

  // Newest first: the most recent usable scene is the one that matters.
  for (const interval of [...intervals].reverse()) {
    const bands = interval?.outputs?.default?.bands;
    if (!bands) continue;

    const names = Object.keys(bands).sort();
    const first = bands[names[0]]?.stats;
    if (!first || !first.sampleCount) continue;

    const validFraction = 1 - (first.noDataCount ?? 0) / first.sampleCount;
    const means = names.map((n) => Number(bands[n]?.stats?.mean));
    if (validFraction <= 0 || means.some((m) => !Number.isFinite(m))) continue;

    return {
      means,
      validFraction,
      date: String(interval.interval.from).slice(0, 10),
    };
  }

  return null;
};
