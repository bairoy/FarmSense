import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { CreateFieldPayload } from "../field.types";
import { getFieldById, updateField } from "../field.service";

export default function EditField() {
  const { fieldId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateFieldPayload>({
    location_name: "",
    latitude: 0,
    longitude: 0,
    soil_type: "",
    area: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch field data
  useEffect(() => {
    if (!fieldId) return;

    const fetchField = async () => {
      try {
        const res = await getFieldById(fieldId);
        const data = res.data;

        setForm({
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          soil_type: data.soil_type,
          area: data.area,
        });
      } catch (err) {
        setError("Failed to load field data.");
      } finally {
        setLoading(false);
      }
    };

    fetchField();
  }, [fieldId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]:
        name === "latitude" ||
        name === "longitude" ||
        name === "area"
          ? Number(value)
          : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fieldId) return;

    setSaving(true);
    setError(null);

    try {
      await updateField(fieldId, form);
      navigate("/fields");
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to update field."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div>Loading field...</div>;
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow border">
      <h2 className="text-2xl font-semibold mb-6">
        Edit Field
      </h2>

      {error && (
        <div className="bg-red-50 text-red-600 border border-red-200 p-3 mb-5 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Field Name */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Field Name
          </label>
          <input
            name="location_name"
            value={form.location_name}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
            required
          />
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Latitude
            </label>
            <input
              name="latitude"
              type="number"
              step="any"
              value={form.latitude}
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Longitude
            </label>
            <input
              name="longitude"
              type="number"
              step="any"
              value={form.longitude}
              onChange={handleChange}
              className="w-full border p-3 rounded-lg"
              required
            />
          </div>
        </div>

        {/* Soil Type */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Soil Type
          </label>
          <input
            name="soil_type"
            value={form.soil_type}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
            required
          />
        </div>

        {/* Area */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Area (acres)
          </label>
          <input
            name="area"
            type="number"
            step="any"
            value={form.area}
            onChange={handleChange}
            className="w-full border p-3 rounded-lg"
            required
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg disabled:opacity-50"
        >
          {saving ? "Updating..." : "Update Field"}
        </button>
      </form>
    </div>
  );
}
