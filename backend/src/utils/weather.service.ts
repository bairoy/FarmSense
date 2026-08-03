// src/utils/weather.service.ts

/**
 * Open-Meteo weather access.
 *
 * Three distinct jobs, deliberately separate functions:
 *
 *   getHistoricalWeather - past days, for replaying the water balance from
 *     sowing to today. Stitches the archive and forecast APIs because the
 *     archive lags ~5 days behind real time.
 *
 *   getForecastWeather - future days. This is what the "irrigate now or wait
 *     for rain?" decision runs on, and it is a genuinely different question
 *     from "what happened". The archive endpoint cannot answer it.
 *
 *   Both return the raw variables Penman-Monteith needs, so the ETo we compute
 *     ourselves is comparable across the two sources.
 */

export type WeatherDay = {
  date: string;
  rainfall: number;
  temp_max: number;
  temp_min: number;
  humidity: number;
  /** Open-Meteo's own FAO-56 ETo. Used as a cross-check, not as the source. */
  et0_openmeteo: number;
  /** 10 m wind, m/s. NASA POWER's 2 m value is preferred when available. */
  wind_speed_10m: number;
  /** Shortwave radiation, MJ m-2 day-1 (converted from Open-Meteo's Wh/m2). */
  solar_radiation_mj: number;
  /** True when this row came from the forecast model rather than reanalysis. */
  is_forecast: boolean;
};

const DAILY_VARS = [
  "precipitation_sum",
  "temperature_2m_max",
  "temperature_2m_min",
  "relative_humidity_2m_mean",
  "et0_fao_evapotranspiration",
  "wind_speed_10m_max",
  "shortwave_radiation_sum",
].join(",");

const iso = (d: Date) => d.toISOString().split("T")[0];

/** Open-Meteo reports shortwave_radiation_sum in MJ/m2 already. */
const toMj = (value: number | null | undefined): number => value ?? 0;

const parseDaily = (data: any, isForecast: boolean, into: Map<string, WeatherDay>) => {
  const dates: string[] = data?.daily?.time ?? [];

  for (let i = 0; i < dates.length; i++) {
    into.set(dates[i], {
      date: dates[i],
      rainfall: data.daily.precipitation_sum?.[i] ?? 0,
      temp_max: data.daily.temperature_2m_max?.[i] ?? 0,
      temp_min: data.daily.temperature_2m_min?.[i] ?? 0,
      humidity: data.daily.relative_humidity_2m_mean?.[i] ?? 0,
      et0_openmeteo: data.daily.et0_fao_evapotranspiration?.[i] ?? 0,
      // Open-Meteo gives max wind in km/h; FAO-56 wants m/s.
      wind_speed_10m: (data.daily.wind_speed_10m_max?.[i] ?? 7.2) / 3.6,
      solar_radiation_mj: toMj(data.daily.shortwave_radiation_sum?.[i]),
      is_forecast: isForecast,
    });
  }
};

const fetchDaily = async (
  url: string,
  isForecast: boolean,
  into: Map<string, WeatherDay>
) => {
  const response = await fetch(url);

  if (!response.ok) {
    console.error(
      `Open-Meteo ${isForecast ? "forecast" : "archive"} failed:`,
      response.status,
      await response.text()
    );
    return;
  }

  parseDaily(await response.json(), isForecast, into);
};

/**
 * Weather for days that have already happened.
 *
 * The archive API is reanalysis (accurate, ~5 days behind); the forecast API
 * also serves the last ~92 days from the operational model. We take archive
 * where available and forecast for the recent tail, because reanalysis is the
 * better number wherever it exists.
 */
export const getHistoricalWeather = async (
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Map<string, WeatherDay>> => {
  const weatherMap = new Map<string, WeatherDay>();

  const start = new Date(startDate);
  const end = new Date(endDate);

  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - 6);

  if (start <= archiveCutoff) {
    const archiveEnd = end < archiveCutoff ? end : archiveCutoff;
    await fetchDaily(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&start_date=${iso(start)}&end_date=${iso(archiveEnd)}&daily=${DAILY_VARS}&timezone=auto`,
      false,
      weatherMap
    );
  }

  if (end > archiveCutoff) {
    const forecastStart = start > archiveCutoff ? new Date(start) : new Date(archiveCutoff);
    if (start <= archiveCutoff) {
      forecastStart.setDate(forecastStart.getDate() + 1); // avoid overlapping the archive
    }

    if (forecastStart <= end) {
      await fetchDaily(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&start_date=${iso(forecastStart)}&end_date=${iso(end)}&daily=${DAILY_VARS}&timezone=auto`,
        true,
        weatherMap
      );
    }
  }

  if (weatherMap.size === 0) {
    throw new Error("Weather fetch failed for both archive and forecast APIs.");
  }

  return weatherMap;
};

/**
 * Weather for days that have not happened yet.
 *
 * Separate from the historical path on purpose. The irrigation-timing rule
 * asks "will meaningful rain arrive before the crop crosses its critical
 * depletion threshold?", and that question can only be answered by a forecast.
 * Open-Meteo serves up to 16 days; beyond ~7 the skill drops sharply, which is
 * why the decision logic never gambles a crop on a distant forecast.
 */
export const getForecastWeather = async (
  lat: number,
  lon: number,
  days = 10
): Promise<WeatherDay[]> => {
  const weatherMap = new Map<string, WeatherDay>();

  await fetchDaily(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&forecast_days=${Math.min(16, days)}&daily=${DAILY_VARS}&timezone=auto`,
    true,
    weatherMap
  );

  return [...weatherMap.values()].sort((a, b) => a.date.localeCompare(b.date));
};
