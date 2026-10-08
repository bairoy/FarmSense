import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, Sprout, Trash2 } from "lucide-react";

import { getCropsByField, deleteCrop } from "../crop.service";
import type { Crop } from "../crop.types";
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  ConfirmDialog,
  Skeleton,
} from "../../../components/ui";

/** Days since sowing, which is what the whole growth model is anchored to. */
const daysSince = (isoDate: string) => {
  const start = new Date(isoDate).getTime();
  if (Number.isNaN(start)) return null;
  return Math.floor((Date.now() - start) / 86_400_000);
};

export default function CropsByField() {
  const { fieldId } = useParams();

  const [crops, setCrops] = useState<Crop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Crop | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!fieldId) return;
    let active = true;

    getCropsByField(fieldId)
      .then((data) => active && setCrops(data))
      .catch(() => {
        if (!active) return;
        setError("Could not load the crops for this field.");
        setCrops([]);
      });

    return () => {
      active = false;
    };
  }, [fieldId]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await deleteCrop(pendingDelete.id);
      setCrops((current) => (current ?? []).filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
    } catch {
      setError("Could not delete that crop. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (crops === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  return (
    <>
      {error && (
        <Alert tone="error" className="mb-4">
          {error}
        </Alert>
      )}

      {crops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-clay-300 px-5 py-10 text-center">
          <Sprout className="mx-auto h-8 w-8 text-clay-300" />
          <p className="mt-3 font-semibold text-clay-800">
            Nothing sown on this field yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-clay-500">
            Record the crop and the date you sowed or transplanted it. Every
            growth stage is measured from that date.
          </p>
          <ButtonLink to="crops/new" className="mt-5" size="sm">
            Record a crop
          </ButtonLink>
        </div>
      ) : (
        <ul className="space-y-3">
          {crops.map((crop) => {
            const age = daysSince(crop.sowing_date);

            return (
              <li
                key={crop.id}
                className="flex items-center gap-3 rounded-xl border border-clay-200 bg-white p-3 transition-colors hover:border-field-300"
              >
                <Link
                  to={`/crop/${crop.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-field-100 text-field-700">
                    <Sprout className="h-5 w-5" />
                  </span>

                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-bold capitalize text-clay-900">
                        {crop.crop_type}
                      </span>
                      <Badge tone={crop.status === "active" ? "field" : "neutral"}>
                        {crop.status}
                      </Badge>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-sm text-clay-500">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Sown {crop.sowing_date}
                      {age !== null && age >= 0 && (
                        <span className="text-clay-400">&middot; day {age}</span>
                      )}
                    </span>
                  </span>

                  <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-clay-400" />
                </Link>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(crop)}
                  aria-label={`Delete this ${crop.crop_type} crop`}
                  className="shrink-0 text-alert-600 hover:bg-alert-50 hover:text-alert-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete this ${pendingDelete?.crop_type ?? "crop"}?`}
        body="Its diagnoses, fertilizer log and irrigation log go with it. This cannot be undone."
        confirmLabel="Delete crop"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
