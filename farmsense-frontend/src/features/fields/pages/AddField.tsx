import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../../services/api";
import { LocationPicker } from "../components/LocationPicker";
import { AreaInput, type AreaValue } from "../components/AreaInput";
import { useRegion, areaToSqm } from "../../../services/region";
import { apiErrorMessage } from "../../../services/apiError";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  PageHeader,
  TextField,
} from "../../../components/ui";

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

  // Start the pin at the district centre once the region config arrives; the
  // farmer then moves it to their own plot. Not hardcoded, so a region change
  // cannot leave the map opening in the wrong country.
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

    if (!region) return;

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
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ to: "/fields", label: "My fields" }}
        title="Add a field"
        description="Record the plot as it appears on your land record. Everything the app calculates is measured from this."
      />

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert tone="error">{error}</Alert>}

          <TextField
            label="Field name"
            placeholder="e.g. Ganga side plot, North bigha"
            hint="Whatever you call it when you talk about it."
            value={form.location_name}
            onChange={(e) => setForm({ ...form, location_name: e.target.value })}
            required
          />

          <AreaInput value={area} onChange={setArea} />

          <LocationPicker
            value={{ latitude: form.latitude, longitude: form.longitude }}
            onChange={(p) => setForm({ ...form, ...p })}
            region={region}
          />

          <p className="text-xs text-clay-500">
            Soil water-holding capacity is looked up for this exact point from
            ISRIC SoilGrids when you view crop health.
          </p>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <ButtonLink to="/fields" variant="ghost">
              Cancel
            </ButtonLink>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Saving..." : "Save field"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
