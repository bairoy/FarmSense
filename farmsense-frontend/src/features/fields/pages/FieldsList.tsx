
// import { useEffect, useState } from "react";
// import { Link } from "react-router-dom";
// import type { Field } from "../field.types";
// import { getFields, deleteField } from "../field.service";

// export default function FieldsList() {
//   const [fields, setFields] = useState<Field[]>([]);
//   const [loading, setLoading] = useState(true);

//   const fetchFields = async () => {
//     try {
//       const res = await getFields();
//       setFields(res.data);
//     } catch (err) {
//       console.error("Failed to fetch fields");
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchFields();
//   }, []);

//   const handleDelete = async (id: string) => {
//     if (!confirm("Delete this field?")) return;

//     try {
//       await deleteField(id);
//       setFields((prev) => prev.filter((f) => f.id !== id));
//     } catch {
//       alert("Delete failed");
//     }
//   };

//   if (loading) return <div>Loading fields...</div>;

//   return (
//     <div>
//       <div className="flex justify-between items-center mb-6">
//         <h2 className="text-xl font-bold">Fields</h2>

//         <Link
//           to="/fields/new"
//           className="bg-green-600 text-white px-4 py-2 rounded"
//         >
//           Add Field
//         </Link>
//       </div>

//       {fields.length === 0 ? (
//         <div>No fields created yet.</div>
//       ) : (
//         <div className="bg-white shadow rounded overflow-hidden">
//           <table className="w-full text-left">
//             <thead className="bg-gray-100">
//               <tr>
//                 <th className="p-3">Name</th>
//                 <th className="p-3">Soil</th>
//                 <th className="p-3">Area</th>
//                 <th className="p-3">Actions</th>
//               </tr>
//             </thead>

//             <tbody>
//               {fields.map((field) => (
//                 <tr key={field.id} className="border-t">
//                   <td className="p-3">{field.location_name}</td>
//                   <td className="p-3">{field.soil_type}</td>
//                   <td className="p-3">{field.area} acres</td>

//                   <td className="p-3 space-x-3">
//                     <Link
//                       to={`/field/${field.id}`}
//                       className="text-blue-600"
//                     >
//                       View
//                     </Link>

//                     <Link
//                       to={`/field/edit/${field.id}`}
//                       className="text-green-600"
//                     >
//                       Edit
//                     </Link>

//                     <button
//                       onClick={() => handleDelete(field.id)}
//                       className="text-red-600"
//                     >
//                       Delete
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//             </tbody>

//           </table>
//         </div>
//       )}
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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-green-700 text-lg">
        Loading fields...
      </div>
    );

  return (
    <div className="min-h-screen bg-green-50 px-6 pt-24 pb-10">

      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-green-800">
            Your Fields 🌾
          </h2>
          <p className="text-green-700 mt-1">
            Manage your rice and wheat fields efficiently
          </p>
        </div>

        <Link
          to="/fields/new"
          className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition shadow-sm"
        >
          + Add Field
        </Link>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto">

        {fields.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-10 text-center">
            <h3 className="text-xl font-semibold text-green-800">
              No Fields Yet 🌱
            </h3>
            <p className="text-gray-600 mt-2">
              Start by adding your first rice or wheat field to begin monitoring.
            </p>

            <Link
              to="/fields/new"
              className="inline-block mt-5 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition"
            >
              Add Your First Field
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-2xl border border-green-100 overflow-hidden">

            <table className="w-full text-left">

              {/* TABLE HEADER */}
              <thead className="bg-green-100 text-green-800 text-sm uppercase tracking-wide">
                <tr>
                  <th className="p-4">Field Name</th>
                  <th className="p-4">Soil Type</th>
                  <th className="p-4">Area</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>
                {fields.map((field) => (
                  <tr
                    key={field.id}
                    className="border-t hover:bg-green-50 transition"
                  >
                    <td className="p-4 font-medium text-green-900">
                      {field.location_name}
                    </td>

                    <td className="p-4 text-gray-700">
                      {field.soil_type}
                    </td>

                    <td className="p-4 text-gray-700">
                      {field.area} acres
                    </td>

                    <td className="p-4 text-center space-x-4">

                      <Link
                        to={`/field/${field.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </Link>

                      <Link
                        to={`/field/edit/${field.id}`}
                        className="text-green-600 hover:underline"
                      >
                        Edit
                      </Link>

                      <button
                        onClick={() => handleDelete(field.id)}
                        className="text-red-600 hover:underline"
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
    </div>
  );
}