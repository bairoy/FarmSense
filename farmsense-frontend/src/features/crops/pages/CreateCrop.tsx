import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

import { createCrop } from "../crop.service";
import { useRegion } from "../../../services/region";
import {
  Alert,
  Button,
  ButtonLink,
  SelectField,
  TextField,
} from "../../../components/ui";

/**
 * Irrigation sources in common use on the eastern Gangetic plain. Recorded for
 * context; the water balance is driven by logged irrigation events, not by
 * this field.
 */
const IRRIGATION_METHODS = [
  "tubewell (boring)",
  "canal",
  "pump set from river or pond",
  "rainfed only",
];

export default function CreateCrop() {
  const { fieldId } = useParams();
  const navigate = useNavigate();
  const { region, loading } = useRegion();

  const [form, setForm] = useState({
    field_id: fieldId!,
    crop_type: "",
    sowing_date: "",
    irrigation_method: IRRIGATION_METHODS[0],
    status: "active",
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * The crop list comes from the region calibration rather than being typed
   * here. The engine looks up its Kc curve and GDD boundaries by this exact
   * key, so a value the region has no entry for produces a confident timeline
   * built from the wrong crop's physics.
   */
  useEffect(() => {
    if (region && !form.crop_type) {
      setForm((f) => ({ ...f, crop_type: region.crops[0]?.key ?? "" }));
    }
  }, [region, form.crop_type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await createCrop(form);
      navigate(`/field/${fieldId}/crops`);
    } catch (err) {
      // The backend rejects a crop type the region has no calibration for, and
      // that message names the crops it does support - worth showing verbatim.
      const message = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      setError(message || "Could not create the crop. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selected = region?.crops.find((c) => c.key === form.crop_type);

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
      {error && <Alert tone="error">{error}</Alert>}

      <SelectField
        label="Crop"
        value={form.crop_type}
        onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
        disabled={loading || !region}
        hint={selected ? `Calibrated for ${selected.variety}.` : undefined}
        required
      >
        {region?.crops.map((crop) => (
          <option key={crop.key} value={crop.key}>
            {crop.key.charAt(0).toUpperCase() + crop.key.slice(1)} ({crop.season})
          </option>
        ))}
      </SelectField>

      <TextField
        label="Sowing or transplanting date"
        type="date"
        value={form.sowing_date}
        onChange={(e) => setForm({ ...form, sowing_date: e.target.value })}
        hint="Every growth stage and fertilizer timing is measured from this date, so it is worth getting right."
        // A sowing date in the future would run the growth model from a day
        // that has not happened.
        max={new Date().toISOString().slice(0, 10)}
        required
      />

      <SelectField
        label="Water source"
        value={form.irrigation_method}
        onChange={(e) => setForm({ ...form, irrigation_method: e.target.value })}
      >
        {IRRIGATION_METHODS.map((method) => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
        <ButtonLink to={`/field/${fieldId}/crops`} variant="ghost">
          Cancel
        </ButtonLink>
        <Button type="submit" disabled={saving || !form.crop_type}>
          {saving ? "Saving..." : "Save crop"}
        </Button>
      </div>
    </form>
  );
}
