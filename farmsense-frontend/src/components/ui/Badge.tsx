import type { ReactNode } from "react";

type Tone = "field" | "harvest" | "water" | "alert" | "neutral";

const TONES: Record<Tone, string> = {
  field: "bg-field-100 text-field-800 border-field-200",
  harvest: "bg-harvest-100 text-harvest-900 border-harvest-200",
  water: "bg-water-100 text-water-800 border-water-200",
  alert: "bg-alert-100 text-alert-800 border-alert-200",
  neutral: "bg-clay-100 text-clay-700 border-clay-200",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * A single measured quantity.
 *
 * `value` is the number; `label` says what it is; `sub` carries the qualifier
 * that keeps the number honest. The qualifier is not optional decoration - a
 * health score with no indication of how it was derived is the exact failure
 * this product exists to avoid.
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "field",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    field: "bg-field-50 text-field-700",
    harvest: "bg-harvest-50 text-harvest-800",
    water: "bg-water-50 text-water-700",
    alert: "bg-alert-50 text-alert-700",
    neutral: "bg-clay-100 text-clay-600",
  };

  return (
    <div className="rounded-xl border border-clay-200 bg-white p-4">
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent[tone]}`}
          >
            {icon}
          </span>
        )}
        <p className="text-xs font-bold uppercase tracking-wide text-clay-500">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular text-clay-900 first-letter:capitalize">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-sm text-clay-500">{sub}</p>}
    </div>
  );
}
