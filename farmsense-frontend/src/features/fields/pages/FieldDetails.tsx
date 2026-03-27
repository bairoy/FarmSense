import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFieldById } from "../field.service";
import type { Field } from "../field.types";
import {Link} from "react-router-dom";
import { Outlet } from "react-router-dom";


export default function FieldDetails() {
  const { fieldId } = useParams();
  console.log("FieldDetails rendered");
  const [field, setField] = useState<Field | null>(null);

  useEffect(() => {
    if (!fieldId) return;

    getFieldById(fieldId).then((res) =>
      setField(res.data)
    );
  }, [fieldId]);

  if (!field) return (
  <>
    <div>Loading...</div>
    <Outlet/>
     {/* ← allow child routes to render while parent loads */}
  </>
);

  return (
    <div className="bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">
        {field.location_name}
      </h2>

      <div className="space-y-2">
        <p><strong>Latitude:</strong> {field.latitude}</p>
        <p><strong>Longitude:</strong> {field.longitude}</p>
        <p><strong>Soil:</strong> {field.soil_type}</p>
        <p><strong>Area:</strong> {field.area} acres</p>
        <p><strong>Created:</strong> {new Date(field.created_at).toLocaleString()}</p>
      </div>
      <div className="mt-6 flex gap-3">
  <Link
    to={`/field/${fieldId}/crops`}
    className="bg-blue-600 text-white px-4 py-2 rounded"
  >
    View Crops
  </Link>

  <Link
    to={`/field/${fieldId}/crops/new`}
    className="bg-green-600 text-white px-4 py-2 rounded"
  >
    Add Crop
  </Link>
</div>
   <Outlet/>
    </div>
  );
}
