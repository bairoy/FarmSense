import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { createIrrigation } from "../irrigation.service";
import { apiErrorMessage } from "../../../services/apiError";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  TextField,
} from "../../../components/ui";

/**
 * A common tubewell in this district moves roughly 10 litres a second, which is
 * the same figure the irrigation recommendation uses to quote pump hours. It is
 * offered here as a conversion because nobody knows how many litres they put on
 * a field - they know they ran the pump for two hours.
 */
const PUMP_LITRES_PER_SECOND = 10;
const LITRES_PER_PUMP_HOUR = PUMP_LITRES_PER_SECOND * 3600;

export default function AddIrrigation() {
  const { cropId } = useParams();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"hours" | "litres">("hours");
  const [hours, setHours] = useState("");
  const [litres, setLitres] = useState("");
  const [actionDate, setActionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amount =
    mode === "hours"
      ? Math.round((Number(hours) || 0) * LITRES_PER_PUMP_HOUR)
      : Math.round(Number(litres) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropId) return;

    if (amount <= 0) {
      setError(
        mode === "hours"
          ? "Enter how long the pump ran."
          : "Enter how many litres you applied."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createIrrigation({
        crop_instance_id: cropId,
        amount,
        action_date: actionDate,
      });
      navigate(`/crop/${cropId}/irrigation`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not save this record. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title="Log an irrigation"
        description="Water you have already applied. The soil water balance drifts from reality until this is recorded."
      />

      <form onSubmit={handleSubmit} className="mt-5 max-w-lg space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        {/* The form used to ask only for litres. Nobody measures litres at a
            tubewell; they measure the clock. */}
        <div>
          <p className="mb-1.5 text-sm font-semibold text-clay-800">
            How do you want to record it?
          </p>
          <div
            role="radiogroup"
            aria-label="Recording method"
            className="grid grid-cols-2 gap-2"
          >
            {(
              [
                { key: "hours", label: "Pump hours" },
                { key: "litres", label: "Litres" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={mode === key}
                onClick={() => setMode(key)}
                className={`min-h-11 rounded-xl border px-4 font-semibold transition-colors ${
                  mode === key
                    ? "border-field-500 bg-field-50 text-field-800"
                    : "border-clay-300 bg-white text-clay-600 hover:bg-clay-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "hours" ? (
          <TextField
            label="Hours the pump ran"
            type="number"
            min="0"
            step="0.25"
            inputMode="decimal"
            placeholder="2"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            hint={
              amount > 0
                ? `About ${amount.toLocaleString()} litres on a ${PUMP_LITRES_PER_SECOND} L/s pump.`
                : `Assumes a ${PUMP_LITRES_PER_SECOND} L/s tubewell — the same pump the recommendations use.`
            }
            required
          />
        ) : (
          <TextField
            label="Litres applied"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="72000"
            value={litres}
            onChange={(e) => setLitres(e.target.value)}
            hint={
              amount > 0
                ? `About ${(amount / LITRES_PER_PUMP_HOUR).toFixed(1)} hours of pumping.`
                : undefined
            }
            required
          />
        )}

        <TextField
          label="Date watered"
          type="date"
          value={actionDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setActionDate(e.target.value)}
          required
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <ButtonLink to={`/crop/${cropId}/irrigation`} variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save record"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
