import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createFertilizer } from "../fertilizer.service";

export default function AddFertilizer() {
  const { cropId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fertilizer_type: "",
    quantity: 0,
    action_date: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: name === "quantity" ? Number(value) : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cropId) return;

    await createFertilizer({
      ...form,
      crop_instance_id: cropId,
    });

    navigate(`/crop/${cropId}/fertilizer`);
  };

  return (
    <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
      <h2 className="text-xl font-bold mb-4">Add Fertilizer</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="fertilizer_type"
          placeholder="Fertilizer Type"
          className="w-full border p-3 rounded"
          onChange={handleChange}
          required
        />

        <input
          name="quantity"
          type="number"
          placeholder="Quantity (kg)"
          className="w-full border p-3 rounded"
          onChange={handleChange}
          required
        />

        <input
          name="action_date"
          type="date"
          className="w-full border p-3 rounded"
          onChange={handleChange}
        />

        <button className="w-full bg-green-600 text-white p-3 rounded">
          Add Fertilizer
        </button>
      </form>
    </div>
  );
}