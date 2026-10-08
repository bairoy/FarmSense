import { useRegion, areaToSqm } from "../../../services/region";
import { Skeleton, Alert } from "../../../components/ui";

/**
 * Land area input in the region's customary units.
 *
 * Farmers do not think in acres or hectares - they think in the units written
 * on their land record. Asking for "area in acres" gets a rough conversion done
 * in someone's head; asking for "2 bigha 5 katha" gets the real number.
 *
 * The unit ladder and its conversion factors come from the backend rather than
 * being declared here, so there is exactly one place a unit constant lives.
 * This component only previews the conversion; the backend recomputes the
 * canonical value from the raw components it receives.
 */

export type AreaValue = Record<string, number>;

export function AreaInput({
  value,
  onChange,
}: {
  value: AreaValue;
  onChange: (next: AreaValue) => void;
}) {
  const { region, error, loading } = useRegion();

  const set = (key: string) => (raw: string) => {
    const parsed = Number(raw);
    onChange({
      ...value,
      [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
    });
  };

  if (loading) {
    return (
      <div>
        <Label />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (error || !region) {
    return (
      <div>
        <Label />
        <Alert tone="error">
          Could not load the area units for your region. Reload the page and try
          again.
        </Alert>
      </div>
    );
  }

  const levels = region.land_units.levels;
  const smallest = levels[levels.length - 1];
  const sqm = areaToSqm(value, levels);

  return (
    <div>
      <Label />
      <p className="mb-3 text-sm text-clay-500">
        As written on your khatauni. Leave a box empty if it does not apply.
      </p>

      {/* A ladder of three or four boxes is laid out as a real grid rather than
          squeezed onto one line - on a 360px screen four inputs share 40px each
          and the unit names underneath become unreadable. */}
      <div className="grid grid-cols-3 gap-3">
        {levels.map((level) => (
          <div key={level.key}>
            <input
              type="number"
              min={0}
              // The smallest unit is only a few square metres, so a whole-number
              // step would make small plots impossible to enter accurately.
              step={level.key === smallest.key ? 0.5 : 1}
              inputMode="decimal"
              value={value[level.key] || ""}
              onChange={(e) => set(level.key)(e.target.value)}
              placeholder="0"
              aria-label={level.label}
              className="w-full rounded-xl border border-clay-300 bg-white px-3 py-3 text-center text-lg font-semibold tabular text-clay-900 placeholder:font-normal placeholder:text-clay-300 focus:border-field-500 focus:outline-none focus:ring-4 focus:ring-field-500/15"
            />
            <p className="mt-1.5 text-center text-sm font-semibold capitalize text-clay-700">
              {level.label}
            </p>
            <p className="text-center text-xs text-clay-400">{level.label_local}</p>
          </div>
        ))}
      </div>

      {/* Live conversion. Fertilizer and irrigation quantities are computed
          from this number, so the farmer should see it before saving. */}
      {sqm > 0 && (
        <p className="mt-3 rounded-lg bg-field-50 px-3 py-2.5 text-sm text-field-900">
          That is{" "}
          <span className="font-bold tabular">
            {sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m&sup2;
          </span>{" "}
          <span className="text-field-700">
            ({(sqm / 10000).toFixed(3)} hectares)
          </span>
          . Fertilizer and water amounts are calculated from this.
        </p>
      )}
    </div>
  );
}

function Label() {
  return (
    <p className="mb-1.5 block text-sm font-semibold text-clay-800">
      Field area <span className="text-alert-600">*</span>
    </p>
  );
}
