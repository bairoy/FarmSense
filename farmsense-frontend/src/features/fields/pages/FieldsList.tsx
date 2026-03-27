// import { useEffect, useState } from "react";
// import { api } from "../../../services/api";
// import { Link } from "react-router-dom";
// import type { Field } from "../field.types";

// export default function FieldsList() {
//   const [fields, setFields] = useState<Field[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchFields = async () => {
//       try {
//         const res = await api.get("/fields");
//         setFields(res.data);
//       } catch (err) {
//         console.error("Failed to fetch fields");
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchFields();
//   }, []);

//   if (loading) return <div>Loading...</div>;

//   return (
//     <div>
//       <h2 className="text-xl font-bold mb-4">Your Fields</h2>

//       <Link
//         to="/fields/new"
//         className="bg-green-600 text-white px-4 py-2 rounded"
//       >
//         Add Field
//       </Link>

//       <div className="mt-6 space-y-4">
//         {fields.map((field) => (
//           <div
//             key={field.id}
//             className="bg-white p-4 rounded shadow"
//           >
//             <h3 className="font-semibold">
//               {field.location_name}
//             </h3>
//             <p className="text-sm text-gray-600">
//               {field.soil_type} • {field.area} acres
//             </p>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Field } from "../field.types";
import { getFields, deleteField } from "../field.service";

export default function FieldsList() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFields = async () => {
    try {
      const res = await getFields();
      setFields(res.data);
    } catch (err) {
      console.error("Failed to fetch fields");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this field?")) return;

    try {
      await deleteField(id);
      setFields((prev) => prev.filter((f) => f.id !== id));
    } catch {
      alert("Delete failed");
    }
  };

  if (loading) return <div>Loading fields...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Fields</h2>

        <Link
          to="/fields/new"
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Add Field
        </Link>
      </div>

      {fields.length === 0 ? (
        <div>No fields created yet.</div>
      ) : (
        <div className="bg-white shadow rounded overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Soil</th>
                <th className="p-3">Area</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-t">
                  <td className="p-3">{field.location_name}</td>
                  <td className="p-3">{field.soil_type}</td>
                  <td className="p-3">{field.area} acres</td>

                  <td className="p-3 space-x-3">
                    <Link
                      to={`/field/${field.id}`}
                      className="text-blue-600"
                    >
                      View
                    </Link>

                    <Link
                      to={`/field/edit/${field.id}`}
                      className="text-green-600"
                    >
                      Edit
                    </Link>

                    <button
                      onClick={() => handleDelete(field.id)}
                      className="text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}
