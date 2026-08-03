import { getForecastWeather, type WeatherDay } from "../../utils/weather.service.ts";
import { irrigationRequirement } from "../rules/waterBalance.ts";
import { paddyIrrigationRequirement, type PaddyState, type PaddyConfig } from "../rules/paddy.model.ts";
import { describeArea } from "../../utils/landUnits.ts";

/**
 * Irrigation advice = two independent questions.
 *
 *   DOSAGE  "How much water does this field need?" Falls straight out of the
 *           water balance - it is the depletion, adjusted for how much of what
 *           you apply actually reaches the root zone.
 *
 *   TIMING  "Should I irrigate now, or wait for rain?" Cannot be answered from
 *           the water balance at all. It needs a FORECAST, which is a
 *           different Open-Meteo endpoint from the archive the rest of the
 *           system uses.
 *
 * Conflating them is how you end up telling a farmer to irrigate the morning
 * before 60 mm of monsoon rain, or to wait for rain that arrives after the
 * crop has already crossed its critical threshold.
 */

/** Below this, a day's rain is not a meaningful contribution to the deficit. */
const MEANINGFUL_RAIN_MM = 10;

/** Beyond ~7 days Open-Meteo's daily skill degrades sharply. We do not bet a
 *  crop on day 12 of a forecast. */
const TRUSTED_FORECAST_DAYS = 7;

export type IrrigationDecision = {
  action: "irrigate_now" | "wait_for_rain" | "no_action_needed" | "drain";
  urgency: "critical" | "high" | "moderate" | "none";
  reason: string;
  dosage: {
    depth_mm: number;
    volume_litres: number;
    volume_m3: number;
    /** Rough pump runtime, for farmers who think in hours not cubic metres. */
    pump_hours_estimate: number | null;
  } | null;
  forecast: {
    expected_rain_mm_7d: number;
    first_meaningful_rain: { date: string; mm: number } | null;
    days_until_critical: number | null;
    forecast_trusted: boolean;
  };
  caveats: string[];
};

/** Typical Terai diesel pump discharge, litres/second. Used only to translate
 *  a volume into something a farmer can time. */
const PUMP_LITRES_PER_SECOND = 10;

const pumpHours = (litres: number): number =>
  Number((litres / PUMP_LITRES_PER_SECOND / 3600).toFixed(1));

/**
 * How many days until the crop crosses its critical threshold if nothing is
 * done and no rain falls.
 *
 * This is the clock the whole timing decision runs against. Waiting for rain
 * is only safe if the rain arrives before this runs out.
 */
const daysUntilCritical = (
  currentDepletion: number,
  criticalDepletion: number,
  dailyEtc: number
): number | null => {
  if (dailyEtc <= 0) return null;
  if (currentDepletion >= criticalDepletion) return 0;
  return Math.floor((criticalDepletion - currentDepletion) / dailyEtc);
};

const summariseForecast = (forecast: WeatherDay[]) => {
  const trusted = forecast.slice(0, TRUSTED_FORECAST_DAYS);

  const total = trusted.reduce((sum, d) => sum + d.rainfall, 0);
  const first = trusted.find((d) => d.rainfall >= MEANINGFUL_RAIN_MM);

  return {
    expected_rain_mm_7d: Number(total.toFixed(1)),
    first_meaningful_rain: first ? { date: first.date, mm: Number(first.rainfall.toFixed(1)) } : null,
    daysToRain: first ? trusted.indexOf(first) : null,
  };
};

/** Upland (wheat) irrigation decision. */
export const decideUplandIrrigation = async (input: {
  latitude: number;
  longitude: number;
  areaSqm: number;
  depletion: number;
  RAW: number;
  TAW: number;
  dailyEtc: number;
  phase: string;
}): Promise<IrrigationDecision> => {
  const forecast = await getForecastWeather(input.latitude, input.longitude, 10).catch(
    () => [] as WeatherDay[]
  );

  const summary = summariseForecast(forecast);
  const forecastTrusted = forecast.length > 0;

  // "Critical" is where the crop stops being able to extract water usefully -
  // partway between RAW (stress begins) and TAW (nothing left). Waiting past
  // this point costs yield permanently.
  const critical = input.RAW + (input.TAW - input.RAW) * 0.5;
  const daysLeft = daysUntilCritical(input.depletion, critical, input.dailyEtc);

  const depthMm = irrigationRequirement(input.depletion);
  const litres = depthMm * input.areaSqm; // 1 mm over 1 m2 = 1 litre

  const dosage = {
    depth_mm: depthMm,
    volume_litres: Math.round(litres),
    volume_m3: Number((litres / 1000).toFixed(1)),
    pump_hours_estimate: pumpHours(litres),
  };

  const isCriticalPhase = ["flowering", "reproductive", "stem_elongation"].includes(input.phase);
  const caveats: string[] = [];

  if (!forecastTrusted) {
    caveats.push(
      "Weather forecast is unavailable, so this decision assumes no rain. If rain is expected, reduce or delay the application."
    );
  }

  // --- Nothing needed yet ---
  if (input.depletion < input.RAW * 0.6) {
    return {
      action: "no_action_needed",
      urgency: "none",
      reason: `Soil water is comfortable: ${input.depletion.toFixed(0)} mm depleted against ${input.RAW.toFixed(0)} mm readily available.`,
      dosage: null,
      forecast: { ...summary, days_until_critical: daysLeft, forecast_trusted: forecastTrusted },
      caveats,
    };
  }

  // --- Already past the point where waiting is defensible ---
  // This branch comes before any rain check on purpose. Once the crop is at
  // or near critical, "wait for rain" is a gamble with a whole season staked
  // on a forecast, and forecasts are wrong often enough that the trade is
  // never worth it.
  if (daysLeft !== null && daysLeft <= 1) {
    return {
      action: "irrigate_now",
      urgency: "critical",
      reason: `The crop reaches its critical moisture threshold within ${daysLeft} day(s). Irrigate now rather than waiting on a forecast - if the rain does not arrive, the yield loss cannot be recovered.`,
      dosage,
      forecast: { ...summary, days_until_critical: daysLeft, forecast_trusted: forecastTrusted },
      caveats,
    };
  }

  // --- Rain is coming, and it arrives in time ---
  if (
    forecastTrusted &&
    summary.first_meaningful_rain &&
    summary.daysToRain !== null &&
    daysLeft !== null &&
    summary.daysToRain < daysLeft
  ) {
    // One more guard: during a yield-critical phase we require real headroom,
    // not a photo finish, because being wrong here is unrecoverable.
    const headroom = daysLeft - summary.daysToRain;

    if (!isCriticalPhase || headroom >= 2) {
      return {
        action: "wait_for_rain",
        urgency: "moderate",
        reason: `${summary.first_meaningful_rain.mm} mm of rain is forecast on ${summary.first_meaningful_rain.date}, ${summary.daysToRain} day(s) from now. The crop does not reach its critical threshold for ${daysLeft} day(s), so there is room to wait and save the water and fuel.`,
        dosage,
        forecast: { ...summary, days_until_critical: daysLeft, forecast_trusted: forecastTrusted },
        caveats: [
          ...caveats,
          "Check again tomorrow. If the forecast changes, irrigate rather than waiting further.",
        ],
      };
    }
  }

  // --- Past RAW, no rain coming in time ---
  if (input.depletion > input.RAW) {
    return {
      action: "irrigate_now",
      urgency: isCriticalPhase ? "critical" : "high",
      reason: `Depletion is ${input.depletion.toFixed(0)} mm against ${input.RAW.toFixed(0)} mm readily available water, and no meaningful rain is forecast before the crop reaches its critical threshold${daysLeft !== null ? ` in ${daysLeft} day(s)` : ""}.`,
      dosage,
      forecast: { ...summary, days_until_critical: daysLeft, forecast_trusted: forecastTrusted },
      caveats,
    };
  }

  return {
    action: "no_action_needed",
    urgency: "moderate",
    reason: `Depletion is approaching the threshold (${input.depletion.toFixed(0)} of ${input.RAW.toFixed(0)} mm). Plan to irrigate within ${daysLeft ?? 3} day(s).`,
    dosage,
    forecast: { ...summary, days_until_critical: daysLeft, forecast_trusted: forecastTrusted },
    caveats,
  };
};

/** Paddy (rice) irrigation decision - re-flooding, not refilling a bucket. */
export const decidePaddyIrrigation = async (input: {
  latitude: number;
  longitude: number;
  areaSqm: number;
  state: PaddyState;
  config: PaddyConfig;
  phase: string;
}): Promise<IrrigationDecision> => {
  const forecast = await getForecastWeather(input.latitude, input.longitude, 10).catch(
    () => [] as WeatherDay[]
  );
  const summary = summariseForecast(forecast);
  const forecastTrusted = forecast.length > 0;

  const depthMm = paddyIrrigationRequirement(input.state, input.config);
  const litres = depthMm * input.areaSqm;

  const dosage = {
    depth_mm: depthMm,
    volume_litres: Math.round(litres),
    volume_m3: Number((litres / 1000).toFixed(1)),
    pump_hours_estimate: pumpHours(litres),
  };

  const baseForecast = {
    ...summary,
    days_until_critical: input.state.flooded ? null : 0,
    forecast_trusted: forecastTrusted,
  };

  const isCriticalPhase = ["flowering", "reproductive", "panicle_initiation"].includes(input.phase);

  // Late season: draining is correct, not a problem to fix.
  if (["grain_filling", "maturity"].includes(input.phase)) {
    return {
      action: "drain",
      urgency: "none",
      reason:
        "The crop is in grain filling / maturity. Drain the field about 10 days before harvest so the soil firms up and harvesting is easier.",
      dosage: null,
      forecast: baseForecast,
      caveats: [],
    };
  }

  if (input.state.flooded && input.state.pondedDepthMm >= input.config.targetDepthMm * 0.5) {
    return {
      action: "no_action_needed",
      urgency: "none",
      reason: `The paddy holds about ${input.state.pondedDepthMm.toFixed(0)} mm of standing water against a ${input.config.targetDepthMm} mm target.`,
      dosage: null,
      forecast: baseForecast,
      caveats: [],
    };
  }

  if (isCriticalPhase) {
    // No forecast gamble during flowering. Spikelet sterility from even a
    // short dry spell here is permanent.
    return {
      action: "irrigate_now",
      urgency: "critical",
      reason: `The paddy is not adequately flooded during ${input.phase}. Re-flood immediately - water deficit at this stage causes spikelet sterility, which no later action can undo. Do not wait on the forecast.`,
      dosage,
      forecast: baseForecast,
      caveats: [],
    };
  }

  if (
    forecastTrusted &&
    summary.first_meaningful_rain &&
    summary.daysToRain !== null &&
    summary.daysToRain <= 2 &&
    input.state.dryDays < 3
  ) {
    return {
      action: "wait_for_rain",
      urgency: "moderate",
      reason: `${summary.first_meaningful_rain.mm} mm of rain is forecast on ${summary.first_meaningful_rain.date}, and the field has only been dry for ${input.state.dryDays} day(s). A bunded field retains rainfall well, so waiting is reasonable.`,
      dosage,
      forecast: baseForecast,
      caveats: ["Re-check tomorrow. If the rain does not materialise, re-flood."],
    };
  }

  return {
    action: "irrigate_now",
    urgency: input.state.dryDays >= 5 ? "high" : "moderate",
    reason: `The paddy has been dry for ${input.state.dryDays} day(s) and no meaningful rain is forecast within two days. Re-flood to the ${input.config.targetDepthMm} mm target depth.`,
    dosage,
    forecast: baseForecast,
    caveats: [],
  };
};

/** Attaches area context so the UI can show the field the volume refers to. */
export const withAreaContext = (decision: IrrigationDecision, areaSqm: number) => ({
  ...decision,
  area: describeArea(areaSqm),
});
