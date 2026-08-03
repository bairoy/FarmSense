/**
 * Land area input in Bigha-Kattha-Dhur.
 *
 * Farmers in the Terai do not think in acres or hectares - they think in the
 * units written on their land certificate. Asking for "area in acres" gets a
 * rough conversion done in someone's head; asking for "2 bigha 5 kattha" gets
 * the real number.
 *
 * These constants MUST match backend/src/utils/landUnits.ts exactly. They are
 * duplicated here only to show a live preview; the backend recomputes the
 * canonical value from the raw components it receives, so a drift here would
 * show a wrong preview but could never corrupt stored data.
 */

const SQM_PER_DHUR = 16.93;
const SQM_PER_KATTHA = SQM_PER_DHUR * 20;
const SQM_PER_BIGHA = SQM_PER_KATTHA * 20;

export type AreaValue = { bigha: number; kattha: number; dhur: number };

export const areaToSqm = (value: AreaValue): number =>
  value.bigha * SQM_PER_BIGHA +
  value.kattha * SQM_PER_KATTHA +
  value.dhur * SQM_PER_DHUR;

export function AreaInput({
  value,
  onChange,
}: {
  value: AreaValue;
  onChange: (next: AreaValue) => void;
}) {
  const sqm = areaToSqm(value);

  const set = (key: keyof AreaValue) => (raw: string) => {
    const parsed = Number(raw);
    onChange({ ...value, [key]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Field Area
      </label>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["bigha", "Bigha", "बिघा"],
            ["kattha", "Kattha", "कट्ठा"],
            ["dhur", "Dhur", "धुर"],
          ] as const
        ).map(([key, label, nepali]) => (
          <div key={key}>
            <input
              type="number"
              min={0}
              // Dhur is only ~17 m2, so a whole-number step would make small
              // plots impossible to enter accurately.
              step={key === "dhur" ? 0.5 : 1}
              value={value[key] || ""}
              onChange={(e) => set(key)(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              {label} <span className="text-gray-400">{nepali}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Live conversion. Fertilizer and irrigation quantities are computed
          from this number, so the farmer should see it before saving. */}
      {sqm > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          = {sqm.toLocaleString(undefined, { maximumFractionDigits: 0 })} m²
          ({(sqm / 10000).toFixed(3)} hectares).
          Fertilizer and water amounts are calculated from this.
        </p>
      )}
    </div>
  );
}
