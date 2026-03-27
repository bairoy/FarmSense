import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createCrop } from "../crop.service";

export default function CreateCrop() {
  const { fieldId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    field_id: fieldId!,
    crop_type: "",
    sowing_date: "",
    irrigation_method: "",
    status: "active",
  });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await createCrop(form);
    navigate(`/field/${fieldId}/crops`);
  };

  return (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-xl font-bold mb-4">Create Crop</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Crop type"
          className="border p-2 w-full mb-2"
          onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
        />

        <input
          type="date"
          className="border p-2 w-full mb-2"
          onChange={(e) => setForm({ ...form, sowing_date: e.target.value })}
        />

        <input
          placeholder="Irrigation"
          className="border p-2 w-full mb-4"
          onChange={(e) =>
            setForm({ ...form, irrigation_method: e.target.value })
          }
        />

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Create Crop
        </button>
      </form>
    </div>
  );
}
