# Building a Scientific Digital Twin: Transitioning from Heuristics to FAO-56 & GDD

This document explains the architectural shift in FarmSense from a heuristic, rule-based approach to a scientifically grounded, physics-based digital twin.

## The Problem with Heuristics
Initially, FarmSense estimated crop health using two major assumptions:
1. **Calendar Days for Growth:** Assuming day 45 is *always* the vegetative stage.
2. **Arbitrary Penalties for Water:** Assuming a drop in soil moisture directly correlates to a flat `-X` penalty on health.

In reality, crops develop based on **accumulated heat** (not calendar days), and water stress only occurs when the soil physically runs out of **Readily Available Water** (RAW). To build a true digital twin without physical IoT sensors, we must use process-based crop simulation.

---

## Concept 1: Phenology tracking via Growing Degree Days (GDD)

Crops develop faster in warm weather and slower in cold weather. We model this using **Growing Degree Days (GDD)**.

### The Math
Each day, the crop accumulates "heat units" above a specific base temperature ($T_{base}$) below which the crop will not grow. For rice, $T_{base} = 10^\circ C$.

```math
GDD = \max\left(0, \frac{T_{max} + T_{min}}{2} - T_{base}\right)
```

By summing these daily GDDs from the sowing date, we know exactly what phase the crop is in, regardless of how many calendar days have passed. For example, Basmati rice typically requires ~2000 GDD to reach full maturity.

### Implementation snippet (`timeline.engine.ts`)
```typescript
// Calculate daily GDD based on Open-Meteo weather
const T_mean = (tempMax + tempMin) / 2;
const gddToday = Math.max(0, T_mean - cropConfig.base_temperature_c);
cumulativeGDD += gddToday;

// Determine crop phase by checking cumulative GDD against thresholds
let currentPhase = "unknown";
let kc = 1.0;
for (const phase of cropConfig.phases) {
  if (cumulativeGDD >= phase.gdd_start && cumulativeGDD < phase.gdd_end) {
    currentPhase = phase.name;
    kc = phase.kc; // Crop coefficient for water balance
    break;
  }
}
```

---

## Concept 2: The FAO-56 Soil Water Balance

Instead of guessing if a crop is thirsty, we model the soil root zone as a "bucket" of water. 

### The Math
We track **Soil Water Depletion** (how empty the bucket is).
1. **Inflow:** Rainfall + Irrigation
2. **Outflow (Evapotranspiration or ETc):** $ETc = ET_0 \times K_c$
   - **$ET_0$ (Reference Evapotranspiration):** Provided by weather API (Penman-Monteith).
   - **$K_c$ (Crop Coefficient):** Depends on the crop phase (e.g., higher during flowering).

```math
Depletion_{today} = \max(0, Depletion_{yesterday} + ETc - Rainfall - Irrigation)
```
*Note: Depletion cannot be less than 0, as 0 means the soil is at full "Field Capacity". Any excess water becomes runoff or deep percolation.*

Water stress **only** occurs when the depletion exceeds the soil's **Readily Available Water (RAW)**.

### Implementation snippet (`agronomic.engine.ts`)
```typescript
// 1. Water balance updated daily in the timeline engine:
const ETc = et0 * kc;
soilDepletion = soilDepletion + ETc - (rainfall + irrigationAmount);
soilDepletion = Math.max(0, soilDepletion); // Clamp to Field Capacity

// 2. Stress evaluated in agronomic engine:
if (input.soilDepletion > input.RAW) {
  water_stress = true;
  
  // Penalty scales with how far past RAW the depletion is
  const excessDepletion = input.soilDepletion - input.RAW;
  const penalty = Math.min(40, excessDepletion * 2);
  health_score -= penalty;

  recommendations.push("Immediate irrigation required to prevent yield loss.");
}
```

---

## Concept 3: Regional Localization

To make this math work, the constants (like $K_c$, RAW, and GDD thresholds) cannot be global. They depend heavily on the specific geography, soil type, and crop variety. 

We scoped the first working implementation strictly to **Gorakhpur, Uttar Pradesh**.

### Configuration snippet (`regions/gorakhpur.json`)
```json
{
  "region": "Gorakhpur, Uttar Pradesh, India",
  "soil": {
    "type": "alluvial",
    "total_available_water_mm_per_m": 150
  },
  "crops": {
    "rice": {
      "variety": "Eastern UP kharif lowland (e.g. Sarju-52, NDR-359, Swarna)",
      "base_temperature_c": 10,
      "root_depth_m": 0.4,
      "depletion_fraction_p": 0.2,
      "phases": [
        { "name": "seedling",      "gdd_start": 0,    "gdd_end": 350,  "kc": 1.05 },
        { "name": "tillering",     "gdd_start": 350,  "gdd_end": 900,  "kc": 1.15 },
        { "name": "flowering",     "gdd_start": 900,  "gdd_end": 1400, "kc": 1.20 },
        { "name": "grain_filling", "gdd_start": 1400, "gdd_end": 2000, "kc": 0.90 }
      ]
    }
  }
}
```

By calculating RAW as `soil.TAW * crop.root_depth * crop.depletion_fraction`, the engine knows exactly how many millimeters of water the rice can extract from the Saryu/Rapti alluvium before it begins to suffer. This turns FarmSense from a heuristic dashboard into a true scientific digital twin.

Nothing in the engine names a district. Every constant above is read from the region file, so a new district is a new JSON file plus `DEFAULT_REGION`, not a code change — which is exactly how this project moved from Nepal's Terai to eastern UP.
