// src/utils/weather.service.ts

type WeatherDay = {
  date: string;
  rainfall: number;
  temp_max: number;
  temp_min: number;
  humidity: number;
};

export const getHistoricalWeather = async (
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<Map<string, WeatherDay>> => {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startDate}&end_date=${endDate}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean&timezone=auto`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Weather fetch failed");
    }

    const data = await res.json();

    const weatherMap = new Map<string, WeatherDay>();

    const dates = data.daily.time;

    for (let i = 0; i < dates.length; i++) {
      weatherMap.set(dates[i], {
        date: dates[i],
        rainfall: data.daily.precipitation_sum[i] || 0,
        temp_max: data.daily.temperature_2m_max[i] || 0,
        temp_min: data.daily.temperature_2m_min[i] || 0,
        humidity: data.daily.relative_humidity_2m_mean[i] || 0
      });
    }

    return weatherMap;
  } catch (err) {
    console.error("Weather API Error:", err);
    throw err;
  }
};