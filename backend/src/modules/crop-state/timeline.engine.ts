import { differenceInDays, addDays } from "date-fns";
import { getHistoricalWeather } from "../../utils/weather.service.ts";
import { supabase } from "../../config/supabase.ts";

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

  // WEATHER (ONCE)
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

  // IRRIGATION HISTORY (ALL DAYS)
  const { data: irrigation } = await supabase
    .from("irrigation_actions")
    .select("action_date")
    .eq("crop_instance_id", crop.id);

  const irrigationDates = new Set(
    irrigation?.map((i: any) =>
      new Date(i.action_date).toISOString().split("T")[0]
    )
  );

  // STATE VARIABLES
  let soil_moisture = 50;
  let health_score = 100;

  const timeline = [];

  // 🔥 MAIN LOOP
  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(sowingDate, i);
    const dateStr = currentDate.toISOString().split("T")[0];

    const dayNumber = i + 1;
    const phase = getPhase(crop.crop_type, dayNumber);

    const weather = weatherMap.get(dateStr);

    const rainfall = weather?.rainfall || 0;
    const tempMax = weather?.temp_max || 30;
    const humidity = weather?.humidity || 50;

    let stress_factors: string[] = [];

    // =========================
    // WATER MODEL (IMPORTANT)
    // =========================
    soil_moisture += rainfall * 0.5;

    if (irrigationDates.has(dateStr)) {
      soil_moisture += 20;
    }

    soil_moisture -= tempMax * 0.3;

    soil_moisture = Math.max(0, Math.min(100, soil_moisture));

    let water_stress = false;

    if (soil_moisture < 30) {
      water_stress = true;
      stress_factors.push("low soil moisture");
      health_score -= 2;
    }

    // =========================
    // HEAT
    // =========================
    let heat_stress = false;

    if (tempMax > 35) {
      heat_stress = true;
      stress_factors.push("heat stress");
      health_score -= 1.5;
    }

    // =========================
    // DISEASE
    // =========================
    let disease_risk = 0;

    if (humidity > 80 && tempMax < 35) {
      disease_risk = 0.7;
    } else if (humidity > 60) {
      disease_risk = 0.4;
    } else {
      disease_risk = 0.1;
    }

    if (disease_risk > 0.6) {
      health_score -= 1;
    }

    health_score = Math.max(0, Math.min(100, health_score));

    timeline.push({
      date: dateStr,
      day_number: dayNumber,
      phase,
      soil_moisture,
      health_score,
      water_stress,
      heat_stress,
      disease_risk,
      stress_factors
    });
  }

  return timeline;
};