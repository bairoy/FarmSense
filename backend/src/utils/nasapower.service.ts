/**
 * NASA POWER - Prediction Of Worldwide Energy Resources.
 *
 * https://power.larc.nasa.gov/api/temporal/daily/point
 *
 * Free, no API key, and built specifically for agro-climatology. We use it for
 * the two variables Penman-Monteith needs and that Open-Meteo's daily archive
 * does not expose cleanly:
 *
 *   ALLSKY_SFC_SW_DWN - incoming shortwave radiation, MJ m-2 day-1
 *   WS2M              - wind speed at 2 m, m/s
 *
 * Wind at 2 m specifically matters: most weather APIs report 10 m wind, and
 * using a 10 m value in FAO-56 eq. 6 without the log-profile correction
 * overstates ETo by roughly 15-25%. POWER gives us the 2 m value directly.
 *
 * POWER lags real time by roughly 2-7 days, so recent days and forecasts fall
 * back to Open-Meteo and Hargreaves ETo. That degradation is recorded, not
 * hidden - it lowers the confidence attached to the crop state.
 */

const POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point";

export type PowerDay = {
  date: string;
  solarRadiationMj: number;
  windSpeed2m: number;
  tempMaxC: number;
  tempMinC: number;
  humidityPct: number;
};

const PARAMETERS = [
  "ALLSKY_SFC_SW_DWN", // MJ/m2/day
  "WS2M", // m/s
  "T2M_MAX",
  "T2M_MIN",
  "RH2M",
].join(",");

/** POWER uses YYYYMMDD, with -999 as its missing-value sentinel. */
const compact = (iso: string) => iso.replace(/-/g, "");
const MISSING = -999;

export const getPowerDaily = async (
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<Map<string, PowerDay>> => {
  const result = new Map<string, PowerDay>();

  const params = new URLSearchParams({
    parameters: PARAMETERS,
    community: "AG", // agroclimatology community
    latitude: String(latitude),
    longitude: String(longitude),
    start: compact(startDate),
    end: compact(endDate),
    format: "JSON",
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    const response = await fetch(`${POWER_URL}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`NASA POWER returned ${response.status}`);
    }

    const json: any = await response.json();
    const p = json?.properties?.parameter;
    if (!p) throw new Error("NASA POWER response missing parameter block");

    for (const key of Object.keys(p.ALLSKY_SFC_SW_DWN ?? {})) {
      const iso = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;

      const radiation = p.ALLSKY_SFC_SW_DWN?.[key];
      const wind = p.WS2M?.[key];

      // Skip days POWER has not filled yet rather than letting -999 poison
      // the water balance. A missing day falls through to Open-Meteo.
      if (radiation == null || radiation <= MISSING) continue;

      result.set(iso, {
        date: iso,
        solarRadiationMj: radiation,
        windSpeed2m: wind != null && wind > MISSING ? wind : 2.0,
        tempMaxC: p.T2M_MAX?.[key] > MISSING ? p.T2M_MAX[key] : NaN,
        tempMinC: p.T2M_MIN?.[key] > MISSING ? p.T2M_MIN[key] : NaN,
        humidityPct: p.RH2M?.[key] > MISSING ? p.RH2M[key] : NaN,
      });
    }

    return result;
  } catch (err) {
    console.warn(`NASA POWER unavailable: ${(err as Error).message}`);
    // An empty map is a valid answer meaning "no radiation data" - callers
    // fall back to Hargreaves ETo and mark the day lower-confidence.
    return result;
  }
};
