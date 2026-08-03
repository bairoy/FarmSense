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
const PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process";

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
  extra?: Record<string, unknown>;
};

/**
 * Runs an evalscript over a field boundary and returns the numeric result.
 *
 * We ask Sentinel Hub for a 1x1 pixel output covering the whole polygon. That
 * makes the API average every pixel inside the field for us - the mean is
 * computed server-side, so we transfer a handful of bytes instead of an image
 * we would then have to decode and average ourselves.
 *
 * This is also exactly why field boundaries had to be added first. Averaging
 * over a real polygon gives a crop signal; sampling one pixel at a dropped pin
 * gives whatever happened to be under that pin.
 */
export const runStatisticalRequest = async (
  request: ProcessRequest
): Promise<number[] | null> => {
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
          dataFilter: {
            timeRange: {
              from: `${request.from}T00:00:00Z`,
              to: `${request.to}T23:59:59Z`,
            },
            ...(request.extra ?? {}),
          },
        },
      ],
    },
    output: {
      width: 1,
      height: 1,
      responses: [{ identifier: "default", format: { type: "application/json" } }],
    },
    evalscript: request.evalscript,
  };

  const response = await fetch(PROCESS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 404 || response.status === 400) {
    // No acquisition in this window. Common and expected - monsoon cloud for
    // Sentinel-2, orbit gaps for Sentinel-1. Not an error condition.
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `CDSE process request failed: ${response.status} ${await response.text()}`
    );
  }

  const json: any = await response.json();
  const values = Array.isArray(json) ? json : json?.data ?? json;
  return Array.isArray(values) ? values.map(Number) : null;
};
