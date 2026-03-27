import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getIrrigationHistory, deleteIrrigation } from "../irrigation.service";
import type { Irrigation } from "../irrigation.types";

export default function IrrigationHistory() {
  const { cropId } = useParams();
  const [records, setRecords] = useState<Irrigation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!cropId) return;

    try {
      const res = await getIrrigationHistory(cropId);
      setRecords(res.data);
    } catch {
      alert("Failed to load irrigation history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [cropId]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete record?")) return;

    await deleteIrrigation(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading) return <div>Loading irrigation history...</div>;

  return (
    <div>
      <div className="flex justify-between mb-6">
        <h2 className="text-xl font-bold">Irrigation History</h2>

        
      </div>

      {records.length === 0 ? (
        <div>No irrigation records</div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white p-4 rounded shadow flex justify-between"
            >
              <div>
                <p className="font-semibold">
                  {rec.amount} liters
                </p>
                <p className="text-sm text-gray-600">
                  {rec.action_date}
                </p>
              </div>

              <button
                onClick={() => handleDelete(rec.id)}
                className="text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}