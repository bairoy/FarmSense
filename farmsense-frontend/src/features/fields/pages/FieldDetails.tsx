import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { Compass, Layers, Pencil, Plus, Ruler } from "lucide-react";

import { getFieldById } from "../field.service";
import type { Field } from "../field.types";
import {
  Alert,
  ButtonLink,
  Card,
  LoadingPanel,
  PageHeader,
  Stat,
} from "../../../components/ui";

export default function FieldDetails() {
  const { fieldId } = useParams();

  const [field, setField] = useState<Field | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldId) return;
    let active = true;

    getFieldById(fieldId)
      .then((res) => active && setField(res.data))
      .catch(() => active && setError("Could not load this field."));

    return () => {
      active = false;
    };
  }, [fieldId]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!field) return <LoadingPanel label="Loading field" />;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: "/fields", label: "My fields" }}
        eyebrow="Field"
        title={field.location_name}
        description={`Added ${new Date(field.created_at).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        actions={
          <ButtonLink to={`/field/edit/${field.id}`} variant="secondary">
            <Pencil className="h-4 w-4" />
            Edit
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<Ruler className="h-4 w-4" />}
          label="Area"
          value={field.area?.area_label ?? "Not recorded"}
          sub={field.area ? `${field.area.hectares} hectares` : "Needed for dose amounts"}
          tone={field.area ? "field" : "harvest"}
        />
        <Stat
          icon={<Layers className="h-4 w-4" />}
          label="Soil"
          value={field.soil_type}
          sub="Water capacity from SoilGrids"
        />
        <Stat
          icon={<Compass className="h-4 w-4" />}
          label="Location"
          value={`${field.latitude.toFixed(3)}, ${field.longitude.toFixed(3)}`}
          sub="Weather and satellite are pulled for this point"
          tone="water"
        />
      </div>

      {!field.area && (
        <Alert tone="warning" title="This field has no recorded area">
          Fertilizer and irrigation quantities are calculated per hectare, so
          they cannot be produced until an area is entered.{" "}
          <Link
            to={`/field/edit/${field.id}`}
            className="font-semibold underline underline-offset-2"
          >
            Add the area
          </Link>
          .
        </Alert>
      )}

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-clay-900">Crops on this field</h2>
            <p className="mt-0.5 text-sm text-clay-600">
              One entry per sowing, so a rice season and the wheat that follows
              it stay separate.
            </p>
          </div>

          <ButtonLink to={`/field/${field.id}/crops/new`} size="sm">
            <Plus className="h-4 w-4" />
            Add crop
          </ButtonLink>
        </div>

        {/* The crop list and the create form render here. */}
        <div className="mt-5">
          <Outlet />
        </div>
      </Card>
    </div>
  );
}
