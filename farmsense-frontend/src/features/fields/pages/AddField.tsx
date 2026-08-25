import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../services/api.ts";
import { AreaInput, type AreaValue } from "../components/AreaInput.tsx";
import { useRegion, areaToSqm } from "../../../services/region.ts";
import { apiErrorMessage } from "../../../services/apiError";

export default function AddField() {
  const navigate = useNavigate();
  const { region } = useRegion();

  const [form, setForm] = useState({
    location_name: "",
    latitude: 0,
    longitude: 0,
    soil_type: "alluvial",
  });

  const [area, setArea] = useState<AreaValue>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default the pin to the district centre once the region config arrives.
  // Hardcoding a lat/long here is how a location change leaves fields sitting
  // in the wrong country while everything still looks like it works.
  useEffect(() => {
    if (region) {
      setForm((f) => ({
        ...f,
        latitude: region.coordinates.latitude,
        longitude: region.coordinates.longitude,
      }));
    }
  }, [region]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (areaToSqm(area, region?.land_units.levels ?? []) <= 0) {
      setError(
        "Enter the field area. Without it, fertilizer and water amounts cannot be calculated."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The raw customary-unit components are sent, not a pre-converted
      // number. The backend owns the conversion so there is exactly one place
      // it can be wrong.
      await api.post("/fields", { ...form, ...area });
      navigate("/fields");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create field. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">Create New Field</h2>

        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3 mb-5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name
            </label>
            <input
              placeholder="e.g. North Farm, Green Valley Plot"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.location_name}
              onChange={(e) => setForm({ ...form, location_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {(["latitude", "longitude"] as const).map((key) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                  {key} (locked to {region?.name ?? "your district"})
                </label>
                <input
                  type="number"
                  step="any"
                  className="w-full border border-gray-300 p-3 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                  value={form[key]}
                  readOnly
                />
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soil Type (locked to {region?.name ?? "your district"})
            </label>
            <input
              className="w-full border border-gray-300 p-3 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
              value={form.soil_type}
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Actual soil water-holding capacity is looked up per field from ISRIC
              SoilGrids when you view crop health.
            </p>
          </div>

          <AreaInput value={area} onChange={setArea} />

          <button
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium p-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Field..." : "Create Field"}
          </button>
        </form>
      </div>
    </div>
  );
}
