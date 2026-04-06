import { differenceInDays, addDays } from "date-fns";
import { getHistoricalWeather } from "../../utils/weather.service.ts";
import { supabase } from "../../config/supabase.ts";
import { evaluateAgronomicState } from "../rules/agronomic.engine.ts";
function getPhase(cropType: string, das: number) {
  if (cropType === "rice") {
    if (das <= 15) return "establishment";
    if (das <= 45) return "vegetative";
    if (das <= 75) return "reproductive";
    if (das <= 95) return "grain_filling";
    return "maturity";
  }

  if (cropType === "wheat") {
    if (das <= 15) return "establishment";
    if (das <= 80) return "vegetative";
    if (das <= 110) return "reproductive";
    if (das <= 150) return "grain_filling";
    return "maturity";
  }

  return "unknown";
}
export const computeCropTimeline = async (crop: any) => {
  const today = new Date();
  const sowingDate = new Date(crop.sowing_date);

  const totalDays = differenceInDays(today, sowingDate) + 1;

  // WEATHER
  const startDate = sowingDate.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  let weatherMap = new Map();

  try {
    weatherMap = await getHistoricalWeather(
      crop.fields.latitude,
      crop.fields.longitude,
      startDate,
      endDate
    );
  } catch {
    console.warn("Weather fallback");
  }

  // IRRIGATION
  const { data: irrigation } = await supabase
    .from("irrigation_actions")
    .select("action_date")
    .eq("crop_instance_id", crop.id);

  const irrigationDates = new Set(
    irrigation?.map((i: any) =>
      new Date(i.action_date).toISOString().split("T")[0]
    )
  );

  let soil_moisture = 50;

  const timeline = [];

  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(sowingDate, i);
    const dateStr = currentDate.toISOString().split("T")[0];

    const dayNumber = i + 1;
    const phase = getPhase(crop.crop_type, dayNumber);

    const weather = weatherMap.get(dateStr);

    const rainfall = weather?.rainfall || 0;
    const tempMax = weather?.temp_max || 30;
    const humidity = weather?.humidity || 50;

    // =========================
    // 🌧️ WATER MODEL FIRST
    // =========================

    if (rainfall > 2) {
      soil_moisture += rainfall * 0.8;
    }

    if (irrigationDates.has(dateStr)) {
      soil_moisture += 25;
    }

    let evap = tempMax * 0.2;

    if (humidity < 40) {
      evap *= 1.5;
    }

    soil_moisture -= evap;

    soil_moisture += 1.5;

    soil_moisture = Math.max(10, Math.min(100, soil_moisture));

    // =========================
    // 🧠 RULE ENGINE AFTER UPDATE
    // =========================

    const result = evaluateAgronomicState({
      crop: crop.crop_type,
      phase,
      soil_moisture,
      tempMax,
      humidity,
      rainfall
    });

    timeline.push({
      date: dateStr,
      day_number: dayNumber,
      phase,

      soil_moisture,

      health_score: result.health_score,
      status: result.status,

      water_stress: result.water_stress,
      heat_stress: result.heat_stress,
      disease_risk: result.disease_risk,

      stress_factors: result.stress_factors,
      recommendations: result.recommendations
    });
  }

  return timeline;
};