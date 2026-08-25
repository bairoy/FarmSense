import { ConfidencePanel } from "../../components/ConfidenceBadge";
import type {
  RecommendationBundle,
  IrrigationDecision,
  FertilizerPlan,
} from "./recommendations.service";

const URGENCY_STYLE: Record<IrrigationDecision["urgency"], string> = {
  critical: "bg-red-50 border-red-300 text-red-900",
  high: "bg-orange-50 border-orange-300 text-orange-900",
  moderate: "bg-yellow-50 border-yellow-300 text-yellow-900",
  none: "bg-green-50 border-green-300 text-green-900",
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
      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
        <h3 className="font-semibold text-amber-900">Cannot calculate quantities</h3>
        <p className="mt-1 text-sm text-amber-900">{bundle.blocked}</p>
      </div>
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
  return (
    <div className={`rounded-2xl border p-5 ${URGENCY_STYLE[decision.urgency]}`}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-lg">💧 {ACTION_LABEL[decision.action]}</h3>
        {decision.urgency !== "none" && (
          <span className="text-xs uppercase tracking-wide font-medium opacity-75">
            {decision.urgency}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm">{decision.reason}</p>

      {decision.dosage && decision.action === "irrigate_now" && (
        <div className="mt-4 bg-white/60 rounded-xl p-4 text-sm">
          <p className="font-medium">
            Apply {decision.dosage.depth_mm} mm — {decision.dosage.volume_m3} m³
          </p>
          <p className="text-xs mt-1 opacity-80">
            {decision.dosage.volume_litres.toLocaleString()} litres
            {decision.dosage.pump_hours_estimate !== null && (
              <> · about {decision.dosage.pump_hours_estimate} hours on a 10 L/s pump</>
            )}
          </p>
        </div>
      )}

      <div className="mt-3 text-xs opacity-80 space-y-1">
        <p>
          Forecast: {decision.forecast.expected_rain_mm_7d} mm of rain expected in
          the next 7 days
          {decision.forecast.first_meaningful_rain && (
            <>
              {" "}
              (first meaningful rain {decision.forecast.first_meaningful_rain.mm} mm
              on {decision.forecast.first_meaningful_rain.date})
            </>
          )}
          .
        </p>
        {decision.forecast.days_until_critical !== null && (
          <p>
            The crop reaches its critical moisture threshold in{" "}
            {decision.forecast.days_until_critical} day(s) without water.
          </p>
        )}
        {decision.caveats.map((caveat, i) => (
          <p key={i} className="italic">
            {caveat}
          </p>
        ))}
      </div>
    </div>
  );
}

function FertilizerCard({ plan }: { plan: FertilizerPlan }) {
  return (
    <div className="bg-white rounded-2xl border border-green-200 p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-lg text-green-900">🌱 Fertilizer</h3>
        <span className="text-xs text-gray-500">
          for {plan.area.area_label} ({plan.area.hectares} ha)
        </span>
      </div>

      {plan.current_action ? (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-medium text-green-900">
            Due now: {plan.current_action.name.replace(/_/g, " ")}
            {plan.current_action.due === "overdue" && (
              <span className="ml-2 text-xs text-red-700">(running late)</span>
            )}
          </p>
          <p className="text-xs text-green-800 mt-1">{plan.current_action.timing}</p>

          <ul className="mt-3 space-y-1.5">
            {plan.current_action.products.map((product) => (
              <li key={product.product} className="text-sm text-gray-800">
                <span className="font-medium">{product.label}</span> —{" "}
                {product.local_units}
              </li>
            ))}
          </ul>

          <p className="mt-3 text-xs text-gray-600 italic">
            {plan.current_action.note}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          No fertilizer application is due at this growth stage.
        </p>
      )}

      <details className="mt-4">
        <summary className="text-sm text-gray-700 cursor-pointer hover:text-gray-900">
          Full season schedule
        </summary>

        <div className="mt-3 space-y-2">
          {plan.splits.map((split) => (
            <div
              key={split.name}
              className="text-xs border-l-2 border-gray-200 pl-3 py-1"
            >
              <p className="font-medium capitalize text-gray-800">
                {split.name.replace(/_/g, " ")}{" "}
                <span className="text-gray-400">({split.due.replace("_", " ")})</span>
              </p>
              <p className="text-gray-500">{split.timing}</p>
              <p className="text-gray-700 mt-0.5">
                {split.products.map((p) => `${p.label} ${p.kg} kg`).join(", ") ||
                  "nothing"}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-gray-600">
          Organic: {plan.organic_recommendation}
        </p>

        {plan.micronutrient_recommendation && (
          <p className="mt-2 text-xs text-gray-600">
            Micronutrients: {plan.micronutrient_recommendation}
          </p>
        )}
      </details>

      {plan.adjustments.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {plan.adjustments.map((adjustment, i) => (
            <p key={i} className="text-xs text-amber-900">
              <span className="font-medium capitalize">
                {adjustment.applied.replace("_", " ")}:
              </span>{" "}
              {adjustment.reason}
            </p>
          ))}
        </div>
      )}

      <ul className="mt-4 space-y-1 text-xs text-gray-500 list-disc ml-4">
        {plan.caveats.map((caveat, i) => (
          <li key={i}>{caveat}</li>
        ))}
      </ul>
    </div>
  );
}
