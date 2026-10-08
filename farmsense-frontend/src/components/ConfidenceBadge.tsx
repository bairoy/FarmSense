import { AlertTriangle, CheckCircle2, CircleAlert, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

export type Confidence = {
  score: number;
  band: "high" | "medium" | "low" | "very_low";
  stale_days: number | null;
  factors: string[];
  caveat: string;
};

/**
 * Confidence is a status, so it is drawn from the reserved status palette and
 * never from the decorative one - and it always ships with an icon and a word,
 * never colour alone. A farmer reading this in sunlight, or with a red-green
 * colour deficiency, has to be able to tell a fresh estimate from a stale one.
 */
const BAND: Record<
  Confidence["band"],
  { chip: string; panel: string; bar: string; label: string; icon: ReactNode }
> = {
  high: {
    chip: "bg-field-100 text-field-900 border-field-300",
    panel: "bg-field-50 border-field-200",
    bar: "bg-field-600",
    label: "High confidence",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  medium: {
    chip: "bg-harvest-100 text-harvest-900 border-harvest-300",
    panel: "bg-harvest-50 border-harvest-200",
    bar: "bg-harvest-500",
    label: "Medium confidence",
    icon: <CircleAlert className="h-3.5 w-3.5" />,
  },
  low: {
    chip: "bg-harvest-200 text-harvest-900 border-harvest-400",
    panel: "bg-harvest-50 border-harvest-300",
    bar: "bg-harvest-700",
    label: "Low confidence",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  very_low: {
    chip: "bg-alert-100 text-alert-900 border-alert-300",
    panel: "bg-alert-50 border-alert-200",
    bar: "bg-alert-600",
    label: "Very low confidence",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
};

const staleness = (days: number | null) =>
  days === null
    ? "never checked against independent data"
    : days === 0
      ? "checked today"
      : `checked ${days} day${days === 1 ? "" : "s"} ago`;

/**
 * Confidence, shown next to every number derived from the model.
 *
 * This is a safety control, not decoration. An estimate corrected against a
 * satellite pass yesterday and one that has been free-running for six weeks
 * look identical as bare numbers, and the second one will get someone to spend
 * money on the wrong thing. The badge exists so they never look identical.
 */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const style = BAND[confidence.band];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.chip}`}
      title={confidence.caveat}
    >
      {style.icon}
      {style.label} &middot; {staleness(confidence.stale_days)}
    </span>
  );
}

/**
 * The expanded panel. Shown wherever a farmer is about to act on a number -
 * an irrigation volume or a fertilizer quantity - rather than just browsing.
 */
export function ConfidencePanel({ confidence }: { confidence: Confidence }) {
  const style = BAND[confidence.band];
  const percent = Math.round(confidence.score * 100);

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${style.panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ConfidenceBadge confidence={confidence} />
        <span className="text-xs font-bold tabular text-clay-600">{percent}%</span>
      </div>

      {/* The score as a bar as well as a number. The bar is what gets read at a
          glance; the number is what gets quoted. */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/70"
        role="img"
        aria-label={`Confidence score ${percent} out of 100`}
      >
        <div
          className={`h-full rounded-full ${style.bar}`}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>

      <p className="mt-3 text-sm text-clay-800">{confidence.caveat}</p>

      {confidence.factors.length > 0 && (
        <details className="mt-3 group">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-clay-600 hover:text-clay-900">
            <HelpCircle className="h-3.5 w-3.5" />
            Why is confidence not higher?
          </summary>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-clay-600">
            {confidence.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
