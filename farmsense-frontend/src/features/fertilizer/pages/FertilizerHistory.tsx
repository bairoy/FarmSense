import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Leaf, Plus, Trash2 } from "lucide-react";

import { getFertilizerHistory, deleteFertilizer } from "../fertilizer.service";
import type { Fertilizer } from "../fertilizer.types";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  ConfirmDialog,
  Skeleton,
} from "../../../components/ui";

const SACK_KG = 50;

export default function FertilizerHistory() {
  const { cropId } = useParams();

  const [records, setRecords] = useState<Fertilizer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Fertilizer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // useCallback so the effect below can depend on it honestly. Declaring
  // [cropId] while calling a function rebuilt every render is the stale-closure
  // shape the lint rule exists to catch.
  const fetchHistory = useCallback(async () => {
    if (!cropId) return;

    try {
      const res = await getFertilizerHistory(cropId);
      setRecords(res.data);
    } catch {
      setError("Could not load the fertilizer history.");
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
      await deleteFertilizer(pendingDelete.id);
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

  const total = (records ?? []).reduce((sum, record) => sum + record.quantity, 0);

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={<Leaf className="h-5 w-5" />}
        title="Fertilizer history"
        description={
          total > 0
            ? `${total.toLocaleString()} kg applied this season — about ${(total / SACK_KG).toFixed(1)} sacks.`
            : "Everything you have applied to this crop."
        }
        action={
          <ButtonLink to={`/crop/${cropId}/fertilizer/new`} size="sm">
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
            Nothing recorded yet. Logging what you applied stops the plan from
            recommending a dose you have already given.
          </p>
        ) : (
          <ul className="divide-y divide-clay-100">
            {records.map((record) => (
              <li key={record.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-clay-900">
                    {record.fertilizer_type}
                  </p>
                  <p className="text-sm text-clay-500">
                    <span className="tabular font-medium text-clay-700">
                      {record.quantity} kg
                    </span>
                    {record.action_date && <> &middot; {record.action_date}</>}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPendingDelete(record)}
                  aria-label={`Delete the ${record.fertilizer_type} record`}
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
            ? `${pendingDelete.quantity} kg of ${pendingDelete.fertilizer_type} will be removed from this crop's history, and the plan will recalculate as though it was never applied.`
            : ""
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  );
}
