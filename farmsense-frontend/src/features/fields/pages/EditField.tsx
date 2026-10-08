import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import type { CreateFieldPayload } from "../field.types";
import { LocationPicker } from "../components/LocationPicker";
import { useRegion } from "../../../services/region";
import { AreaInput, type AreaValue } from "../components/AreaInput";
import { getFieldById, updateField } from "../field.service";
import { apiErrorMessage } from "../../../services/apiError";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  LoadingPanel,
  PageHeader,
  TextField,
} from "../../../components/ui";

export default function EditField() {
  const { fieldId } = useParams();
  const navigate = useNavigate();
  const { region } = useRegion();

  const [form, setForm] = useState<CreateFieldPayload>({
    location_name: "",
    latitude: 0,
    longitude: 0,
    soil_type: "",
  });

  const [area, setArea] = useState<AreaValue>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldId) return;
    let active = true;

    getFieldById(fieldId)
      .then((res) => {
        if (!active) return;
        const data = res.data;

        setForm({
          location_name: data.location_name,
          latitude: data.latitude,
          longitude: data.longitude,
          soil_type: data.soil_type,
        });

        // The backend returns the canonical area already decomposed into the
        // region's customary units, so nothing is converted here.
        if (data.area?.units) setArea(data.area.units);
      })
      .catch(() => active && setError("Could not load this field."))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [fieldId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: name === "latitude" || name === "longitude" ? Number(value) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldId) return;

    setSaving(true);
    setError(null);

    try {
      await updateField(fieldId, { ...form, ...area });
      navigate("/fields");
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to update field."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <LoadingPanel label="Loading field" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ to: "/fields", label: "My fields" }}
        title="Edit field"
        description="Correcting the area re-scales every fertilizer and water amount for this plot."
      />

      <Card className="p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <Alert tone="error">{error}</Alert>}

          <TextField
            label="Field name"
            name="location_name"
            value={form.location_name}
            onChange={handleChange}
            required
          />

          <AreaInput value={area} onChange={setArea} />

          <LocationPicker
            value={{ latitude: form.latitude, longitude: form.longitude }}
            onChange={(p) => setForm({ ...form, ...p })}
            region={region}
          />


          <TextField
            label="Soil type"
            name="soil_type"
            value={form.soil_type}
            onChange={handleChange}
            hint="Per-field water-holding capacity still comes from SoilGrids; this is the district description."
            required
          />

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <ButtonLink to="/fields" variant="ghost">
              Cancel
            </ButtonLink>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
