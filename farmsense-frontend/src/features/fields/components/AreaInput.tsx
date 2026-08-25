import { useRegion, areaToSqm } from "../../../services/region";

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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Area
        </label>
        <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !region) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Area
        </label>
        <p className="text-sm text-red-600">
          Could not load the area units for your region. Reload the page and try
          again.
        </p>
      </div>
    );
  }

  const levels = region.land_units.levels;
  const smallest = levels[levels.length - 1];
  const sqm = areaToSqm(value, levels);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Field Area
      </label>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}
      >
        {levels.map((level) => (
          <div key={level.key}>
            <input
              type="number"
              min={0}
              // The smallest unit is only a few square metres, so a whole-number
              // step would make small plots impossible to enter accurately.
              step={level.key === smallest.key ? 0.5 : 1}
              value={value[level.key] || ""}
              onChange={(e) => set(level.key)(e.target.value)}
              placeholder="0"
              aria-label={level.label}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              {level.label}{" "}
              <span className="text-gray-400">{level.label_local}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Live conversion. Fertilizer and irrigation quantities are computed
          from this number, so the farmer should see it before saving. */}
      {sqm > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          = {sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m² (
          {(sqm / 10000).toFixed(3)} hectares). Fertilizer and water amounts are
          calculated from this.
        </p>
      )}
    </div>
  );
}
