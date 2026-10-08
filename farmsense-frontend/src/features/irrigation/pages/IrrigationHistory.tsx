import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Droplets, Plus, Trash2 } from "lucide-react";

import { getIrrigationHistory, deleteIrrigation } from "../irrigation.service";
import type { Irrigation } from "../irrigation.types";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  Skeleton,
} from "../../../components/ui";

const LITRES_PER_PUMP_HOUR = 10 * 3600;

export default function IrrigationHistory() {
  const { cropId } = useParams();

  const [records, setRecords] = useState<Irrigation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Irrigation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // useCallback so the effect below can depend on it honestly. Declaring
  // [cropId] while calling a function rebuilt every render is the stale-closure
  // shape the lint rule exists to catch.
  const fetchHistory = useCallback(async () => {
    if (!cropId) return;

    try {
      const res = await getIrrigationHistory(cropId);
      setRecords(res.data);
    } catch {
      setError("Could not load the irrigation history.");
      setRecords([]);
    }
  }, [cropId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await deleteIrrigation(pendingDelete.id);
      setRecords((current) =>
        (current ?? []).filter((record) => record.id !== pendingDelete.id)
      );
      setPendingDelete(null);
    } catch {
      setError("Could not delete that record.");
    } finally {
      setDeleting(false);
    }
  };

  const total = (records ?? []).reduce((sum, record) => sum + record.amount, 0);

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={<Droplets className="h-5 w-5" />}
        title="Irrigation history"
        description={
          total > 0
            ? `${total.toLocaleString()} litres this season — about ${(total / LITRES_PER_PUMP_HOUR).toFixed(1)} pump hours.`
            : "Every watering you have recorded for this crop."
        }
        action={
          <ButtonLink to={`/crop/${cropId}/irrigation/new`} size="sm">
            <Plus className="h-4 w-4" />
            Log
          </ButtonLink>
        }
      />

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-5">
        {records === null ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : records.length === 0 ? (
          <p className="rounded-xl border border-dashed border-clay-300 px-4 py-8 text-center text-sm text-clay-500">
            Nothing recorded yet. Until a watering is logged the model assumes
            the field got no water at all.
          </p>
        ) : (
          <ul className="divide-y divide-clay-100">
            {records.map((record) => (
              <li key={record.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular text-clay-900">
                    {record.amount.toLocaleString()} litres
                  </p>
                  <p className="text-sm text-clay-500">
                    <span className="tabular">
                      about {(record.amount / LITRES_PER_PUMP_HOUR).toFixed(1)} pump
                      hours
                    </span>
                    {record.action_date && <> &middot; {record.action_date}</>}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(record)}
                  aria-label="Delete this irrigation record"
                  className="shrink-0 text-alert-600 hover:bg-alert-50 hover:text-alert-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this record?"
        body={
          pendingDelete
            ? `${pendingDelete.amount.toLocaleString()} litres will be removed from this crop's water balance, and the model will recalculate as though the field was never watered that day.`
            : ""
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  );
}
