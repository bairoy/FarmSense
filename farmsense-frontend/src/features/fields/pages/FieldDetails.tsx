// import { useEffect, useState } from "react";
// import { useParams } from "react-router-dom";
// import { getFieldById } from "../field.service";
// import type { Field } from "../field.types";
// import {Link} from "react-router-dom";
// import { Outlet } from "react-router-dom";


// export default function FieldDetails() {
//   const { fieldId } = useParams();
//   console.log("FieldDetails rendered");
//   const [field, setField] = useState<Field | null>(null);

//   useEffect(() => {
//     if (!fieldId) return;

//     getFieldById(fieldId).then((res) =>
//       setField(res.data)
//     );
//   }, [fieldId]);

//   if (!field) return (
//   <>
//     <div>Loading...</div>
//     <Outlet/>
//      {/* ← allow child routes to render while parent loads */}
//   </>
// );

//   return (
//     <div className="bg-white p-6 rounded shadow">
//       <h2 className="text-xl font-bold mb-4">
//         {field.location_name}
//       </h2>

//       <div className="space-y-2">
//         <p><strong>Latitude:</strong> {field.latitude}</p>
//         <p><strong>Longitude:</strong> {field.longitude}</p>
//         <p><strong>Soil:</strong> {field.soil_type}</p>
//         <p><strong>Area:</strong> {field.area} acres</p>
//         <p><strong>Created:</strong> {new Date(field.created_at).toLocaleString()}</p>
//       </div>
//       <div className="mt-6 flex gap-3">
//   <Link
//     to={`/field/${fieldId}/crops`}
//     className="bg-blue-600 text-white px-4 py-2 rounded"
//   >
//     View Crops
//   </Link>

//   <Link
//     to={`/field/${fieldId}/crops/new`}
//     className="bg-green-600 text-white px-4 py-2 rounded"
//   >
//     Add Crop
//   </Link>
// </div>
//    <Outlet/>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getFieldById } from "../field.service";
import type { Field } from "../field.types";
import { Link } from "react-router-dom";
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
      <div className="min-h-screen flex items-center justify-center text-green-700 text-lg">
        Loading...
      </div>
      <Outlet />
    </>
  );

  return (
    <div className="min-h-screen bg-green-50 px-6 pt-24 pb-10">

      <div className="max-w-5xl mx-auto">

        {/* HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 mb-6">
          <h2 className="text-3xl font-bold text-green-800">
            {field.location_name} 🌾
          </h2>
          <p className="text-green-700 mt-1">
            Detailed overview of your field
          </p>
        </div>

        {/* DETAILS GRID */}
        <div className="grid md:grid-cols-2 gap-6">

          {/* LOCATION */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              📍 Location
            </h3>

            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Latitude:</strong> {field.latitude}</p>
              <p><strong>Longitude:</strong> {field.longitude}</p>
            </div>
          </div>

          {/* FIELD INFO */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-green-100">
            <h3 className="text-lg font-semibold text-green-800 mb-3">
              🌱 Field Information
            </h3>

            <div className="space-y-2 text-sm text-gray-700">
              <p><strong>Soil Type:</strong> {field.soil_type}</p>
              <p><strong>Area:</strong> {field.area} acres</p>
              <p>
                <strong>Created:</strong>{" "}
                {new Date(field.created_at).toLocaleString()}
              </p>
            </div>
          </div>

        </div>

        {/* ACTION BUTTONS */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/field/${fieldId}/crops`}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition"
          >
            View Crops
          </Link>

          <Link
            to={`/field/${fieldId}/crops/new`}
            className="bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 transition"
          >
            Add Crop
          </Link>
        </div>

        {/* CHILD ROUTES */}
        <div className="mt-6">
          <Outlet />
        </div>

      </div>
    </div>
  );
}