// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { api } from "../services/api";
// import type { CreateFieldPayload } from "../types/field";

// export default function AddField() {
//   const navigate = useNavigate();

//   const [form, setForm] = useState<CreateFieldPayload>({
//     location_name: "",
//     latitude: 0,
//     longitude: 0,
//     soil_type: "",
//     area: 0,
//   });

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const handleChange = (
//     e: React.ChangeEvent<HTMLInputElement>
//   ) => {
//     const { name, value } = e.target;

//     setForm({
//       ...form,
//       [name]:
//         name === "latitude" ||
//         name === "longitude" ||
//         name === "area"
//           ? Number(value)
//           : value,
//     });
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError(null);

//     try {
//       await api.post("/fields", form);
//       navigate("/");
//     } catch (err: any) {
//       setError(
//         err.response?.data?.error || "Failed to create field"
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="max-w-lg mx-auto bg-white p-6 rounded shadow">
//       <h2 className="text-xl font-semibold mb-4">
//         Add New Field
//       </h2>

//       {error && (
//         <div className="bg-red-100 text-red-600 p-2 mb-4 rounded">
//           {error}
//         </div>
//       )}

//       <form onSubmit={handleSubmit} className="space-y-4">
//         <input
//           name="location_name"
//           placeholder="Location Name"
//           className="w-full border p-3 rounded"
//           value={form.location_name}
//           onChange={handleChange}
//           required
//         />

//         <input
//           name="latitude"
//           type="number"
//           step="any"
//           placeholder="Latitude"
//           className="w-full border p-3 rounded"
//           value={form.latitude}
//           onChange={handleChange}
//           required
//         />

//         <input
//           name="longitude"
//           type="number"
//           step="any"
//           placeholder="Longitude"
//           className="w-full border p-3 rounded"
//           value={form.longitude}
//           onChange={handleChange}
//           required
//         />

//         <input
//           name="soil_type"
//           placeholder="Soil Type"
//           className="w-full border p-3 rounded"
//           value={form.soil_type}
//           onChange={handleChange}
//           required
//         />

//         <input
//           name="area"
//           type="number"
//           step="any"
//           placeholder="Area (acres)"
//           className="w-full border p-3 rounded"
//           value={form.area}
//           onChange={handleChange}
//           required
//         />

//         <button
//           disabled={loading}
//           className="w-full bg-green-600 text-white p-3 rounded disabled:opacity-50"
//         >
//           {loading ? "Creating..." : "Create Field"}
//         </button>
//       </form>
//     </div>
//   );
// }

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import type { CreateFieldPayload } from "../types/field";

export default function AddField() {
  const navigate = useNavigate();

  const [form, setForm] = useState<CreateFieldPayload>({
    location_name: "",
    latitude: 0,
    longitude: 0,
    soil_type: "",
    area: 0,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]:
        name === "latitude" ||
        name === "longitude" ||
        name === "area"
          ? Number(value)
          : value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.post("/fields", form);
      navigate("/");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to create field. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-white p-8 rounded-xl shadow-sm border">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6">
          Create New Field
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3 mb-5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Location Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Name
            </label>
            <input
              name="location_name"
              placeholder="e.g. North Farm, Green Valley Plot"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.location_name}
              onChange={handleChange}
              required
            />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                name="latitude"
                type="number"
                step="any"
                placeholder="e.g. 28.6139"
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={form.latitude || ""}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                name="longitude"
                type="number"
                step="any"
                placeholder="e.g. 77.2090"
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                value={form.longitude || ""}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Soil Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Soil Type
            </label>
            <input
              name="soil_type"
              placeholder="e.g. Loamy, Clay, Sandy"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.soil_type}
              onChange={handleChange}
              required
            />
          </div>

          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Area (in acres)
            </label>
            <input
              name="area"
              type="number"
              step="any"
              placeholder="e.g. 4.5"
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={form.area || ""}
              onChange={handleChange}
              required
            />
          </div>

          {/* Submit */}
          <button
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium p-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Field..." : "Create Field"}
          </button>

        </form>
      </div>
    </div>
  );
}