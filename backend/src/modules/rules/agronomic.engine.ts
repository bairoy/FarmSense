import { loadAgronomicRules } from "./rules.loader.ts";

const rules = loadAgronomicRules();


type Inputs = {
  crop: string;
  phase: string;
  soil_moisture: number;
  tempMax: number;
  humidity: number;
  rainfall: number;
};

export const evaluateAgronomicState = (input: Inputs) => {
  const rule = rules.find(
    (r) => r.crop === input.crop && r.phase === input.phase
  );

  // fallback (very important)
  if (!rule) {
    return {
      health_score: 95,
      status: "healthy",
      water_stress: false,
      heat_stress: false,
      disease_risk: 0,
      stress_factors: [],
      recommendations: []
    };
  }

  let water_stress = false;
  let heat_stress = false;
  let disease_risk = 0;

  let stress_factors: string[] = [];
  let recommendations: string[] = [];

  let health_score = 100;

  // =========================
  // 🌧️ WATER (CONTINUOUS)
  // =========================
  const waterDeficit =
    rule.water.min_soil_moisture - input.soil_moisture;

  if (waterDeficit > 0) {
    water_stress = true;

    const penalty = waterDeficit * 0.8;
    health_score -= penalty;

    stress_factors.push("low soil moisture");

    if (waterDeficit > 15) {
      recommendations.push("Immediate irrigation required");
    } else {
      recommendations.push("Irrigation recommended soon");
    }
  }

  // Rain override (important realism)
  if (input.rainfall > 10) {
    water_stress = false;
    recommendations.push("Recent rainfall detected, delay irrigation");
    health_score += 5; // slight recovery
  }

  // =========================
  // 🌡️ HEAT STRESS (CONTINUOUS)
  // =========================
  const heatExcess =
    input.tempMax - rule.temperature.heat_stress;

  if (heatExcess > 0) {
    heat_stress = true;

    const penalty = heatExcess * 1.5;
    health_score -= penalty;

    stress_factors.push("high temperature stress");

    if (heatExcess > 5) {
      recommendations.push("Severe heat stress, irrigate and monitor closely");
    } else {
      recommendations.push("High temperature, monitor crop");
    }
  }

  // =========================
  // 🦠 DISEASE RISK (CONTINUOUS)
  // =========================
  const humidityExcess =
    input.humidity - rule.humidity.disease_risk;

  if (humidityExcess > 0) {
    disease_risk = Math.min(1, humidityExcess / 20);

    const penalty = disease_risk * 20;
    health_score -= penalty;

    stress_factors.push("high humidity disease risk");

    if (disease_risk > 0.5) {
      recommendations.push("High disease risk, inspect crop and consider fungicide");
    } else {
      recommendations.push("Moderate disease risk, monitor crop");
    }
  }

  // =========================
  // ⏳ NATURAL DECAY (REALISM)
  // =========================
  health_score -= 0.3;

  // =========================
  // 🧠 CLAMP VALUES
  // =========================
  health_score = Math.max(0, Math.min(100, health_score));

  // =========================
  // 📊 STATUS
  // =========================
  const status =
    health_score > 85
      ? "healthy"
      : health_score > 65
        ? "mild_stress"
        : health_score > 40
          ? "moderate_stress"
          : "critical";

  return {
    health_score: Math.round(health_score),
    status,
    water_stress,
    heat_stress,
    disease_risk: Number(disease_risk.toFixed(2)),
    stress_factors,
    recommendations
  };
};