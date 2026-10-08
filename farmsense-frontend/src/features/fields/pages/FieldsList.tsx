import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPin, Pencil, Plus, Sprout, Trash2 } from "lucide-react";

import type { Field } from "../field.types";
import { getFields, deleteField } from "../field.service";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Skeleton,
} from "../../../components/ui";

/**
 * The field list.
 *
 * This was a four-column HTML table. On the 360px phone this product is used
 * on, that table either overflowed sideways or crushed "Field Name / Soil /
 * Area / View Edit Delete" into unreadable columns, and Delete sat one thumb
 * width from View with nothing but colour to tell them apart.
 *
 * Cards instead: each field is one tappable block, the destructive action is
 * separated and confirmed, and the layout widens into a grid rather than
 * stretching a table.
 */
export default function FieldsList() {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Field | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;

    getFields()
      .then((res) => active && setFields(res.data))
      .catch(() => {
        if (!active) return;
        setError("Could not load your fields. Check your connection.");
        // Settle to a list so the page renders its empty state rather than
        // spinning skeletons for ever behind an error nobody can act on.
        setFields([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await deleteField(pendingDelete.id);
      setFields((current) =>
        (current ?? []).filter((field) => field.id !== pendingDelete.id)
      );
      setPendingDelete(null);
    } catch {
      setError(`Could not delete ${pendingDelete.location_name}. Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="My fields"
        description="Every plot you farm. Open one to record a crop or check how it is doing."
        actions={
          fields?.length ? (
            <ButtonLink to="/fields/new">
              <Plus className="h-5 w-5" />
              Add field
            </ButtonLink>
          ) : undefined
        }
      />

      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      {fields === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : fields.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-7 w-7" />}
          title="No fields yet"
          description="Add your first plot to start tracking its water, fertilizer and crop health."
          action={
            <ButtonLink to="/fields/new" size="lg">
              <Plus className="h-5 w-5" />
              Add your first field
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              onDelete={() => setPendingDelete(field)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.location_name ?? "this field"}?`}
        body="Its crops, irrigation and fertilizer records and every photo taken of it are deleted with it. This cannot be undone."
        confirmLabel="Delete field"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function FieldCard({ field, onDelete }: { field: Field; onDelete: () => void }) {
  const missingArea = !field.area;

  return (
    <Card as="li" className="flex flex-col overflow-hidden">
      <Link
        to={`/field/${field.id}`}
        className="flex-1 p-5 transition-colors hover:bg-field-50/50"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-field-100 text-field-700">
            <MapPin className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-clay-900">
              {field.location_name}
            </h2>
            <p className="mt-0.5 text-sm capitalize text-clay-500">
              {field.soil_type} soil
            </p>
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="text-xs font-bold uppercase tracking-wide text-clay-400">
              Area
            </dt>
            <dd className="mt-0.5 font-semibold tabular text-clay-800">
              {field.area?.area_label ?? "Not recorded"}
            </dd>
          </div>
          {field.area && (
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-clay-400">
                Hectares
              </dt>
              <dd className="mt-0.5 font-semibold tabular text-clay-800">
                {field.area.hectares}
              </dd>
            </div>
          )}
        </dl>

        {/* Worth interrupting for: with no area the backend cannot produce a
            fertilizer quantity at all, and the farmer will otherwise find that
            out three screens later. */}
        {missingArea && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-harvest-50 p-2.5 text-xs font-medium text-harvest-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-harvest-700" />
            Add the area to get fertilizer and water amounts for this field.
          </p>
        )}
      </Link>

      <div className="flex gap-2 border-t border-clay-100 bg-clay-50/60 px-3 py-2">
        <ButtonLink
          to={`/field/${field.id}/crops`}
          variant="ghost"
          size="sm"
          className="flex-1"
        >
          <Sprout className="h-4 w-4" />
          Crops
        </ButtonLink>

        <ButtonLink
          to={`/field/edit/${field.id}`}
          variant="ghost"
          size="sm"
          aria-label={`Edit ${field.location_name}`}
        >
          <Pencil className="h-4 w-4" />
        </ButtonLink>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          aria-label={`Delete ${field.location_name}`}
          className="text-alert-600 hover:bg-alert-50 hover:text-alert-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
