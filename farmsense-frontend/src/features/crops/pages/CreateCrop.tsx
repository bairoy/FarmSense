import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { createCrop } from "../crop.service";
import { useRegion } from "../../../services/region";

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
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error
        : undefined;
      setError(message || "Could not create the crop. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selected = region?.crops.find((c) => c.key === form.crop_type);

  return (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-xl font-bold mb-4">Create Crop</h2>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-200 p-3 mb-4 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label
            htmlFor="crop_type"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Crop
          </label>
          <select
            id="crop_type"
            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
            value={form.crop_type}
            onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
            disabled={loading || !region}
            required
          >
            {region?.crops.map((crop) => (
              <option key={crop.key} value={crop.key}>
                {crop.key.charAt(0).toUpperCase() + crop.key.slice(1)} ({crop.season})
              </option>
            ))}
          </select>
          {selected && (
            <p className="text-xs text-gray-500 mt-1">
              Calibrated for {selected.variety}.
            </p>
          )}
        </div>

        <div className="mb-3">
          <label
            htmlFor="sowing_date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Sowing / transplanting date
          </label>
          <input
            id="sowing_date"
            type="date"
            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            value={form.sowing_date}
            onChange={(e) => setForm({ ...form, sowing_date: e.target.value })}
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Every growth stage and fertilizer timing is measured from this date.
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="irrigation_method"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Water source
          </label>
          <select
            id="irrigation_method"
            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            value={form.irrigation_method}
            onChange={(e) =>
              setForm({ ...form, irrigation_method: e.target.value })
            }
          >
            {IRRIGATION_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>

        <button
          disabled={saving || !form.crop_type}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Creating..." : "Create Crop"}
        </button>
      </form>
    </div>
  );
}
