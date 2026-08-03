export type Confidence = {
  score: number;
  band: "high" | "medium" | "low" | "very_low";
  stale_days: number | null;
  factors: string[];
  caveat: string;
};

const BAND_STYLES: Record<Confidence["band"], { chip: string; panel: string; label: string }> = {
  high: {
    chip: "bg-green-100 text-green-800 border-green-300",
    panel: "bg-green-50 border-green-200",
    label: "High confidence",
  },
  medium: {
    chip: "bg-yellow-100 text-yellow-800 border-yellow-300",
    panel: "bg-yellow-50 border-yellow-200",
    label: "Medium confidence",
  },
  low: {
    chip: "bg-orange-100 text-orange-800 border-orange-300",
    panel: "bg-orange-50 border-orange-200",
    label: "Low confidence",
  },
  very_low: {
    chip: "bg-red-100 text-red-800 border-red-300",
    panel: "bg-red-50 border-red-200",
    label: "Very low confidence",
  },
};

/**
 * Confidence, shown next to every number derived from the model.
 *
 * This is a safety control, not decoration. An estimate corrected against a
 * satellite pass yesterday and one that has been free-running for six weeks
 * look identical as bare numbers, and the second one will get someone to spend
 * money on the wrong thing. The badge exists so they never look identical.
 */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const style = BAND_STYLES[confidence.band];

  const staleness =
    confidence.stale_days === null
      ? "never checked against independent data"
      : `checked ${confidence.stale_days} day${confidence.stale_days === 1 ? "" : "s"} ago`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${style.chip}`}
      title={confidence.caveat}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {style.label} &middot; {staleness}
    </span>
  );
}

/**
 * The expanded panel. Shown wherever a farmer is about to act on a number -
 * an irrigation volume or a fertilizer quantity - rather than just browsing.
 */
export function ConfidencePanel({ confidence }: { confidence: Confidence }) {
  const style = BAND_STYLES[confidence.band];

  return (
    <div className={`rounded-xl border p-4 ${style.panel}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <ConfidenceBadge confidence={confidence} />
        <span className="text-xs text-gray-500">
          score {(confidence.score * 100).toFixed(0)}%
        </span>
      </div>

      <p className="mt-3 text-sm text-gray-800">{confidence.caveat}</p>

      {confidence.factors.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
            Why is confidence not higher?
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-gray-600 list-disc ml-4">
            {confidence.factors.map((factor, i) => (
              <li key={i}>{factor}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
