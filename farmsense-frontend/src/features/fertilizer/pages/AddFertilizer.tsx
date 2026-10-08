import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { createFertilizer } from "../fertilizer.service";
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
 * Products actually sold at a Gorakhpur co-operative or private dealer. Offered
 * as suggestions rather than a closed list - the field stays free text, because
 * a farmer who used something not on this list must still be able to record it
 * truthfully.
 */
const COMMON_PRODUCTS = [
  "Urea",
  "DAP",
  "MOP (potash)",
  "NPK 12:32:16",
  "SSP",
  "Zinc sulphate",
  "Farmyard manure",
];

/** Fertilizer is bought and carried in 50 kg sacks, not in kilograms. */
const SACK_KG = 50;

export default function AddFertilizer() {
  const { cropId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fertilizer_type: "",
    quantity: "",
    action_date: new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cropId) return;

    const quantity = Number(form.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Enter how many kilograms you applied.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createFertilizer({
        crop_instance_id: cropId,
        fertilizer_type: form.fertilizer_type,
        quantity,
        action_date: form.action_date,
      });
      navigate(`/crop/${cropId}/fertilizer`);
    } catch (err) {
      // Previously this call was not wrapped at all: a failed save navigated
      // away as though it had worked, and the record was simply gone.
      setError(apiErrorMessage(err, "Could not save this record. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const kg = Number(form.quantity);
  const sacks = Number.isFinite(kg) && kg > 0 ? kg / SACK_KG : 0;

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        title="Log a fertilizer application"
        description="What you actually put on the field. The plan adjusts around what you have already applied."
      />

      <form onSubmit={handleSubmit} className="mt-5 max-w-lg space-y-5">
        {error && <Alert tone="error">{error}</Alert>}

        <TextField
          label="Fertilizer"
          name="fertilizer_type"
          list="fertilizer-products"
          placeholder="Urea"
          value={form.fertilizer_type}
          onChange={handleChange}
          required
        />
        <datalist id="fertilizer-products">
          {COMMON_PRODUCTS.map((product) => (
            <option key={product} value={product} />
          ))}
        </datalist>

        <TextField
          label="Quantity in kilograms"
          name="quantity"
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          placeholder="50"
          value={form.quantity}
          onChange={handleChange}
          hint={
            sacks > 0
              ? `That is ${sacks.toFixed(sacks % 1 === 0 ? 0 : 1)} sack${
                  sacks === 1 ? "" : "s"
                } of ${SACK_KG} kg.`
              : `One sack is ${SACK_KG} kg.`
          }
          required
        />

        <TextField
          label="Date applied"
          name="action_date"
          type="date"
          value={form.action_date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={handleChange}
          required
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <ButtonLink to={`/crop/${cropId}/fertilizer`} variant="ghost">
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
