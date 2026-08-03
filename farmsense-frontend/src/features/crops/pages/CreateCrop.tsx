import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createCrop } from "../crop.service";

export default function CreateCrop() {
  const { fieldId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    field_id: fieldId!,
    crop_type: "Basmati rice",
    sowing_date: "",
    irrigation_method: "surface canal system",
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
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Crop Type (Locked to Siraha)
          </label>
          <input
            className="border p-2 w-full rounded bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
            value={form.crop_type}
            readOnly
          />
        </div>

        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sowing Date
          </label>
          <input
            type="date"
            className="border p-2 w-full rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            value={form.sowing_date}
            onChange={(e) => setForm({ ...form, sowing_date: e.target.value })}
            required
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Irrigation (Locked to Siraha)
          </label>
          <input
            className="border p-2 w-full rounded bg-gray-100 text-gray-500 cursor-not-allowed focus:outline-none"
            value={form.irrigation_method}
            readOnly
          />
        </div>

        <button className="bg-green-600 text-white px-4 py-2 rounded">
          Create Crop
        </button>
      </form>
    </div>
  );
}
