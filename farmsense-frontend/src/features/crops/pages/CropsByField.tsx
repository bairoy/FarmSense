import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCropsByField, deleteCrop } from "../crop.service";
import type { Crop } from "../crop.types";

export default function CropsByField() {
  const { fieldId } = useParams();
  console.log("CropsByField rendered, fieldId: ",fieldId);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */
  useEffect(() => {
    let mounted = true;

    const fetchCrops = async () => {
      if (!fieldId) return;

      try {
        setLoading(true);
        const data = await getCropsByField(fieldId);
        if (mounted) setCrops(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCrops();

    return () => {
      mounted = false;
    };
  }, [fieldId]);

  /* ================= DELETE ================= */
  const handleDelete = async (id: string) => {
    if (!fieldId) return;

    try {
      await deleteCrop(id);

      // optimistic update (better UX than refetch)
      setCrops((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  /* ================= UI ================= */
  if (loading) return <div>Loading...</div>;

  return (
    <div>
      

      <div className="mt-4">
        {crops.length === 0 && <div>No crops found</div>}

        {crops.map((crop) => (
          <div
            key={crop.id}
            className="bg-white p-4 rounded shadow mb-2 flex justify-between"
          >
            <div>
              <h3 className="font-bold">{crop.crop_type}</h3>
              <p>{crop.sowing_date}</p>
            </div>

            <div className="flex gap-2">
              <Link
                to={`/crop/${crop.id}`}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                View
              </Link>

              <Link
                to={`/crop/${crop.id}?edit=true`}
                className="bg-yellow-500 text-white px-3 py-1 rounded"
              >
                Edit
              </Link>

              <button
                onClick={() => handleDelete(crop.id)}
                className="bg-red-500 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}