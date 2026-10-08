import {
  AlertTriangle,
  CalendarClock,
  CloudRain,
  Droplets,
  Leaf,
  Timer,
} from "lucide-react";

import { ConfidencePanel } from "../../components/ConfidenceBadge";
import { Alert, Badge } from "../../components/ui";
import type {
  RecommendationBundle,
  IrrigationDecision,
  FertilizerPlan,
} from "./recommendations.service";

/**
 * Urgency is status, not decoration: reserved colours, and always paired with
 * a word so it never depends on hue alone.
 */
const URGENCY: Record<
  IrrigationDecision["urgency"],
  { card: string; chip: string; label: string }
> = {
  critical: {
    card: "bg-alert-50 border-alert-300",
    chip: "bg-alert-600 text-white",
    label: "Act today",
  },
  high: {
    card: "bg-harvest-50 border-harvest-300",
    chip: "bg-harvest-700 text-white",
    label: "Soon",
  },
  moderate: {
    card: "bg-harvest-50 border-harvest-200",
    chip: "bg-harvest-500 text-harvest-900",
    label: "Keep watching",
  },
  none: {
    card: "bg-field-50 border-field-200",
    chip: "bg-field-600 text-white",
    label: "Nothing needed",
  },
};

const ACTION_LABEL: Record<IrrigationDecision["action"], string> = {
  irrigate_now: "Irrigate now",
  wait_for_rain: "Wait for rain",
  no_action_needed: "No watering needed",
  drain: "Drain the field",
};

/**
 * The recommendation panel.
 *
 * Every quantity here is rendered next to the confidence it inherited. That
 * pairing is the whole design: a number on its own invites action, and a
 * number that has not been checked against reality for three weeks should not.
 */
export function RecommendationPanel({ bundle }: { bundle: RecommendationBundle }) {
  if (bundle.blocked) {
    return (
      <Alert tone="warning" title="Cannot calculate quantities">
        {bundle.blocked}
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <ConfidencePanel confidence={bundle.confidence} />
      {bundle.irrigation && <IrrigationCard decision={bundle.irrigation} />}
      {bundle.fertilizer && <FertilizerCard plan={bundle.fertilizer} />}
    </div>
  );
}

function IrrigationCard({ decision }: { decision: IrrigationDecision }) {
  const urgency = URGENCY[decision.urgency];

  return (
    <section className={`rounded-2xl border p-5 ${urgency.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-clay-900">
          <Droplets className="h-5 w-5 text-water-600" />
          {ACTION_LABEL[decision.action]}
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${urgency.chip}`}
        >
          {urgency.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-clay-800">{decision.reason}</p>

      {/* The dose, given as the thing a farmer can actually count: hours on the
          pump. Millimetres are the model's unit, not theirs. */}
      {decision.dosage && decision.action === "irrigate_now" && (
        <div className="mt-4 rounded-xl border border-white bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-clay-500">
            Apply
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular text-clay-900">
            {decision.dosage.depth_mm} mm
            <span className="ml-2 text-base font-bold text-clay-500">
              / {decision.dosage.volume_m3} m&sup3;
            </span>
          </p>
          <p className="mt-1 text-sm tabular text-clay-600">
            {decision.dosage.volume_litres.toLocaleString()} litres
          </p>

          {decision.dosage.pump_hours_estimate !== null && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-water-50 px-3 py-2 text-sm font-semibold text-water-900">
              <Timer className="h-4 w-4 shrink-0 text-water-600" />
              About {decision.dosage.pump_hours_estimate} hours on a 10 L/s pump
            </p>
          )}
        </div>
      )}

      <dl className="mt-4 space-y-2 text-sm text-clay-700">
        <div className="flex gap-2">
          <dt className="shrink-0">
            <CloudRain className="h-4 w-4 text-clay-500" />
            <span className="sr-only">Forecast</span>
          </dt>
          <dd>
            <span className="font-semibold tabular">
              {decision.forecast.expected_rain_mm_7d} mm
            </span>{" "}
            of rain expected in the next 7 days
            {decision.forecast.first_meaningful_rain && (
              <>
                {" "}
                (first meaningful rain{" "}
                {decision.forecast.first_meaningful_rain.mm} mm on{" "}
                {decision.forecast.first_meaningful_rain.date})
              </>
            )}
            .
          </dd>
        </div>

        {decision.forecast.days_until_critical !== null && (
          <div className="flex gap-2">
            <dt className="shrink-0">
              <CalendarClock className="h-4 w-4 text-clay-500" />
              <span className="sr-only">Time remaining</span>
            </dt>
            <dd>
              The crop reaches its critical moisture threshold in{" "}
              <span className="font-semibold tabular">
                {decision.forecast.days_until_critical}
              </span>{" "}
              day(s) without water.
            </dd>
          </div>
        )}
      </dl>

      {decision.caveats.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-clay-200/70 pt-3 text-xs italic text-clay-600">
          {decision.caveats.map((caveat, i) => (
            <li key={i}>{caveat}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FertilizerCard({ plan }: { plan: FertilizerPlan }) {
  return (
    <section className="rounded-2xl border border-clay-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-clay-900">
          <Leaf className="h-5 w-5 text-field-600" />
          Fertilizer
        </h3>
        <span className="text-xs text-clay-500">
          for {plan.area.area_label} ({plan.area.hectares} ha)
        </span>
      </div>

      {plan.current_action ? (
        <div className="mt-4 rounded-xl border border-field-200 bg-field-50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold capitalize text-field-900">
              Due now: {plan.current_action.name.replace(/_/g, " ")}
            </p>
            {plan.current_action.due === "overdue" && (
              <Badge tone="alert">Running late</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-field-800">{plan.current_action.timing}</p>

          {/* The quantity in sacks is the deliverable. These come from
              published rate tables multiplied by the measured field area -
              never from a language model. */}
          <ul className="mt-4 space-y-2">
            {plan.current_action.products.map((product) => (
              <li
                key={product.product}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2.5"
              >
                <span className="font-semibold text-clay-900">{product.label}</span>
                <span className="tabular font-bold text-field-800">
                  {product.local_units}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs italic text-clay-600">
            {plan.current_action.note}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-clay-600">
          No fertilizer application is due at this growth stage.
        </p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-clay-700 hover:text-clay-900">
          Full season schedule
        </summary>

        <ol className="mt-3 space-y-3">
          {plan.splits.map((split) => (
            <li
              key={split.name}
              className="border-l-2 border-clay-200 pl-3 text-xs"
            >
              <p className="font-bold capitalize text-clay-800">
                {split.name.replace(/_/g, " ")}{" "}
                <span className="font-medium text-clay-400">
                  ({split.due.replace(/_/g, " ")})
                </span>
              </p>
              <p className="text-clay-500">{split.timing}</p>
              <p className="mt-0.5 tabular text-clay-700">
                {split.products.map((p) => `${p.label} ${p.kg} kg`).join(", ") ||
                  "nothing"}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-xs text-clay-600">
          Organic: {plan.organic_recommendation}
        </p>

        {plan.micronutrient_recommendation && (
          <p className="mt-2 text-xs text-clay-600">
            Micronutrients: {plan.micronutrient_recommendation}
          </p>
        )}
      </details>

      {plan.adjustments.length > 0 && (
        <div className="mt-4 flex gap-2.5 rounded-lg border border-harvest-200 bg-harvest-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-harvest-700" />
          <div className="space-y-1">
            {plan.adjustments.map((adjustment, i) => (
              <p key={i} className="text-xs text-harvest-900">
                <span className="font-bold capitalize">
                  {adjustment.applied.replace(/_/g, " ")}:
                </span>{" "}
                {adjustment.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      {plan.caveats.length > 0 && (
        <ul className="mt-4 ml-4 list-disc space-y-1 text-xs text-clay-500">
          {plan.caveats.map((caveat, i) => (
            <li key={i}>{caveat}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
