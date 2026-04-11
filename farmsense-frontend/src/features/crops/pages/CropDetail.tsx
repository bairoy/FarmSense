// import { useEffect, useState } from "react";
// import { useParams, useSearchParams } from "react-router-dom";
// import { getCropById, updateCrop, getCurrentCropState, getCropTimeline } from "../crop.service";
// import type { Crop } from "../crop.types";
// import { Outlet } from "react-router-dom";
// import { Link } from "react-router-dom";
// import {
//   LineChart,
//   Line,
//   XAxis,
//   YAxis,
//   Tooltip,
//   CartesianGrid,
//   ResponsiveContainer
// } from "recharts";
// export default function CropDetail() {
//   const { cropId } = useParams();
//   const [searchParams] = useSearchParams();
//   const editMode = searchParams.get("edit") === "true";

//   const [crop, setCrop] = useState<Crop | null>(null);
//   const [date, setDate] = useState("");
//   const [loading, setLoading] = useState(true);
//   const [cropState, setCropState] = useState<any>(null);
//   const [stateLoading, setStateLoading] = useState(false);
//   const [timeline, setTimeline] = useState<any[]>([]);
//   const [timelineLoading, setTimelineLoading] = useState(false);

//   /* ================= FETCH ================= */
//   useEffect(() => {
//     let mounted = true;

//     const fetchCrop = async () => {
//       if (!cropId) return;

//       try {
//         setLoading(true);
//         const data = await getCropById(cropId);
//         if (mounted) {
//           setCrop(data);
//           setDate(data?.sowing_date || "");
//         }
//       } catch (err) {
//         console.error(err);
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     };

//     fetchCrop();

//     return () => {
//       mounted = false;
//     };
//   }, [cropId]);

//   /* ================= UPDATE ================= */
//   const handleUpdate = async () => {
//     if (!cropId) return;

//     try {
//       await updateCrop(cropId, { sowing_date: date });

//       const updated = await getCropById(cropId);
//       setCrop(updated);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const handleAnalyzeCrop = async () => {
//     if (!cropId) return;

//     try {
//       setStateLoading(true);
//       const state = await getCurrentCropState(cropId);
//       setCropState(state);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setStateLoading(false);
//     }
//   };
//   const handleTimeline = async () => {
//     if (!cropId) return;

//     try {
//       setTimelineLoading(true);
//       const data = await getCropTimeline(cropId);
//       setTimeline(data);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setTimelineLoading(false);
//     }
//   };

//   /* ================= UI ================= */
//   if (loading) return <div>Loading...</div>;
//   if (!crop) return <div>No crop found</div>;

//   return (
//     <div className="bg-white p-6 rounded shadow">
//       <h2 className="text-xl font-bold">{crop.crop_type}</h2>
//       <p>Status: {crop.status}</p>
//       <p>Sowing date: {crop.sowing_date}</p>

//       {editMode && (
//         <>
//           <input
//             type="date"
//             className="border p-2 mt-3"
//             value={date}
//             onChange={(e) => setDate(e.target.value)}
//           />

//           <button
//             onClick={handleUpdate}
//             className="bg-green-600 text-white px-4 py-2 ml-2 rounded"
//           >
//             Update
//           </button>
//         </>
//       )}

//       <div className="mt-4 flex gap-3">
//         <Link
//           to="fertilizer"
//           className="bg-blue-600 text-white px-4 py-2 rounded"
//         >
//           Fertilizer History
//         </Link>

//         <Link
//           to="fertilizer/new"
//           className="bg-green-600 text-white px-4 py-2 rounded"
//         >
//           Add Fertilizer
//         </Link>
//       </div>
//       <div className="mt-4 flex gap-3">
//         <Link
//           to="irrigation"
//           className="bg-blue-600 text-white px-4 py-2 rounded"
//         >
//           Irrigation History
//         </Link>

//         <Link
//           to="irrigation/new"
//           className="bg-purple-600 text-white px-4 py-2 rounded"
//         >
//           Add Irrigation
//         </Link>
//       </div>

//       <button
//         onClick={handleAnalyzeCrop}
//         className="bg-yellow-500 text-white px-4 py-2 mt-4 rounded"
//       >
//         Analyze Crop
//       </button>
//       {stateLoading && <p className="mt-3">Analyzing crop...</p>}

//       {cropState && (
//         <div className="mt-6 p-5 border rounded-lg bg-gray-50 shadow-sm">
//           <h3 className="text-xl font-semibold mb-3">Crop Intelligence Report</h3>

//           {/* BASIC INFO */}
//           <p><strong>Phase:</strong> {cropState.phase}</p>
//           <p><strong>Day:</strong> {cropState.day_number}</p>

//           {/* HEALTH */}
//           <div className="mt-3">
//             <p><strong>Health Score:</strong> {cropState.health_score}</p>

//             <div className="w-full bg-gray-200 rounded h-3 mt-1">
//               <div
//                 className={`h-3 rounded ${cropState.health_score > 80
//                   ? "bg-green-500"
//                   : cropState.health_score > 60
//                     ? "bg-yellow-400"
//                     : cropState.health_score > 40
//                       ? "bg-orange-500"
//                       : "bg-red-600"
//                   }`}
//                 style={{ width: `${cropState.health_score}%` }}
//               />
//             </div>

//             <p className="mt-1"><strong>Status:</strong> {cropState.status}</p>
//           </div>

//           {/* STRESS */}
//           <div className="mt-4">
//             <h4 className="font-semibold">Stress Analysis</h4>

//             <p>
//               <strong>Water Stress:</strong>{" "}
//               {cropState.water_stress ? "Yes" : "No"}
//             </p>

//             <p>
//               <strong>Heat Stress:</strong>{" "}
//               {cropState.heat_stress ? "Yes" : "No"}
//             </p>

//             <p>
//               <strong>Disease Risk:</strong>{" "}
//               {(cropState.disease_risk * 100).toFixed(0)}%
//             </p>
//           </div>

//           {/* WEATHER */}
//           {cropState.weather && (
//             <div className="mt-4">
//               <h4 className="font-semibold">Weather Conditions (Today)</h4>

//               <p><strong>Rainfall:</strong> {cropState.weather.rainfall} mm</p>
//               <p><strong>Max Temp:</strong> {cropState.weather.tempMax} °C</p>
//               <p><strong>Humidity:</strong> {cropState.weather.humidity}%</p>
//             </div>
//           )}

//           {/* STRESS FACTORS */}
//           {cropState.stress_factors?.length > 0 && (
//             <div className="mt-4">
//               <strong>Stress Factors:</strong>
//               <ul className="list-disc ml-5">
//                 {cropState.stress_factors.map((f: string, i: number) => (
//                   <li key={i}>{f}</li>
//                 ))}
//               </ul>
//             </div>
//           )}

//           {/* CONFIDENCE
//           <div className="mt-4 text-sm text-gray-600">
//             <strong>AI Confidence:</strong>{" "}
//             {(cropState.confidence_score * 100).toFixed(0)}%
//           </div> */}
//           {/* ✅ MOVE RECOMMENDATIONS HERE */}
//           {cropState.recommendations?.length > 0 && (
//             <div className="mt-4">
//               <strong>Recommendations:</strong>
//               <ul className="list-disc ml-5">
//                 {cropState.recommendations.map((r: string, i: number) => (
//                   <li key={i}>{r}</li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>
//       )}
//       <button
//         onClick={handleTimeline}
//         className="bg-indigo-600 text-white px-4 py-2 mt-2 rounded"
//       >
//         Show Timeline
//       </button>

//       {timelineLoading && <p className="mt-2">Loading timeline...</p>}
//       {timeline.length > 0 && (
//         <div className="mt-6 p-5 border rounded-lg bg-white shadow">
//           <h3 className="text-xl font-semibold mb-4">Crop Timeline</h3>

//           <ResponsiveContainer width="100%" height={300}>
//             <LineChart data={timeline}>
//               <CartesianGrid strokeDasharray="3 3" />
//               <XAxis dataKey="day_number" />
//               <YAxis />
//               <Tooltip />

//               <Line
//                 type="monotone"
//                 dataKey="health_score"
//                 stroke="#16a34a"
//                 name="Health"
//               />

//               <Line
//                 type="monotone"
//                 dataKey="soil_moisture"
//                 stroke="#2563eb"
//                 name="Soil Moisture"
//               />
//             </LineChart>
//           </ResponsiveContainer>
//         </div>
//       )}

//       <Outlet />
//     </div>
//   );
// }

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getCropById, updateCrop, getCurrentCropState, getCropTimeline } from "../crop.service";
import type { Crop } from "../crop.types";
import { Outlet } from "react-router-dom";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";
import CropChatWidget from "../components/CropChatWidget";

export default function CropDetail() {
  const { cropId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  const [crop, setCrop] = useState<Crop | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [cropState, setCropState] = useState<any>(null);
  const [stateLoading, setStateLoading] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchCrop = async () => {
      if (!cropId) return;

      try {
        setLoading(true);
        const data = await getCropById(cropId);
        if (mounted) {
          setCrop(data);
          setDate(data?.sowing_date || "");
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCrop();

    return () => {
      mounted = false;
    };
  }, [cropId]);

  const handleUpdate = async () => {
    if (!cropId) return;

    try {
      await updateCrop(cropId, { sowing_date: date });
      const updated = await getCropById(cropId);
      setCrop(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAnalyzeCrop = async () => {
    if (!cropId) return;

    try {
      setStateLoading(true);
      const state = await getCurrentCropState(cropId);
      setCropState(state);
    } catch (err) {
      console.error(err);
    } finally {
      setStateLoading(false);
    }
  };

  const handleTimeline = async () => {
    if (!cropId) return;

    try {
      setTimelineLoading(true);
      const data = await getCropTimeline(cropId);
      setTimeline(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTimelineLoading(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-green-700 text-lg">
        Loading crop data...
      </div>
    );

  if (!crop) return <div>No crop found</div>;

  return (
    <div className="min-h-screen bg-green-50 px-6 pt-24 pb-10">

      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6">
          <h2 className="text-3xl font-bold text-green-800">
            {crop.crop_type} 🌾
          </h2>
          <p className="text-green-700 mt-1">
            Monitor crop growth, health, and performance
          </p>

          <div className="mt-3 text-sm text-gray-700">
            <p><strong>Status:</strong> {crop.status}</p>
            <p><strong>Sowing Date:</strong> {crop.sowing_date}</p>
          </div>
        </div>

        {/* EDIT MODE */}
        {editMode && (
          <div className="bg-white p-5 rounded-2xl border border-green-100 shadow-sm">
            <h3 className="font-semibold text-green-800 mb-2">
              Update Sowing Date
            </h3>

            <div className="flex gap-3 items-center">
              <input
                type="date"
                className="border p-2 rounded-md"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />

              <button
                onClick={handleUpdate}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
              >
                Update
              </button>
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="fertilizer"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Fertilizer History
          </Link>

          <Link
            to="fertilizer/new"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            Add Fertilizer
          </Link>

          <Link
            to="irrigation"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Irrigation History
          </Link>

          <Link
            to="irrigation/new"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
          >
            Add Irrigation
          </Link>
        </div>

        {/* AI ANALYSIS */}
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
          <button
            onClick={handleAnalyzeCrop}
            className="bg-yellow-500 text-white px-5 py-2 rounded-lg hover:bg-yellow-600 transition"
          >
            Analyze Crop
          </button>

          {stateLoading && (
            <p className="mt-3 text-gray-600">Analyzing crop...</p>
          )}

          {cropState && (
            <div className="mt-6 space-y-4">

              <h3 className="text-xl font-semibold text-green-800">
                Crop Intelligence Report 🧠
              </h3>

              {/* HEALTH */}
              <div>
                <p><strong>Health Score:</strong> {cropState.health_score}</p>

                <div className="w-full bg-gray-200 rounded h-3 mt-2">
                  <div
                    className={`h-3 rounded ${cropState.health_score > 80
                      ? "bg-green-500"
                      : cropState.health_score > 60
                        ? "bg-yellow-400"
                        : cropState.health_score > 40
                          ? "bg-orange-500"
                          : "bg-red-600"
                      }`}
                    style={{ width: `${cropState.health_score}%` }}
                  />
                </div>
              </div>

              {/* INFO GRID */}
              <div className="grid md:grid-cols-2 gap-4 text-sm">

                <div className="bg-green-50 p-4 rounded-xl">
                  <p><strong>Phase:</strong> {cropState.phase}</p>
                  <p><strong>Day:</strong> {cropState.day_number}</p>
                  <p><strong>Status:</strong> {cropState.status}</p>
                </div>

                <div className="bg-green-50 p-4 rounded-xl">
                  <p><strong>Water Stress:</strong> {cropState.water_stress ? "Yes" : "No"}</p>
                  <p><strong>Heat Stress:</strong> {cropState.heat_stress ? "Yes" : "No"}</p>
                  <p><strong>Disease Risk:</strong> {(cropState.disease_risk * 100).toFixed(0)}%</p>
                </div>

              </div>

              {/* WEATHER */}
              {cropState.weather && (
                <div className="bg-blue-50 p-4 rounded-xl text-sm">
                  <p><strong>Rainfall:</strong> {cropState.weather.rainfall} mm</p>
                  <p><strong>Max Temp:</strong> {cropState.weather.tempMax} °C</p>
                  <p><strong>Humidity:</strong> {cropState.weather.humidity}%</p>
                </div>
              )}

              {/* RECOMMENDATIONS */}
              {cropState.recommendations?.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-xl text-sm">
                  <strong>Recommendations:</strong>
                  <ul className="list-disc ml-5 mt-2">
                    {cropState.recommendations.map((r: string, i: number) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TIMELINE */}
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
          <button
            onClick={handleTimeline}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Show Timeline
          </button>

          {timelineLoading && (
            <p className="mt-3 text-gray-600">Loading timeline...</p>
          )}

          {timeline.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-4 text-green-800">
                Crop Timeline 📈
              </h3>

              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day_number" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="health_score" stroke="#16a34a" />
                  <Line type="monotone" dataKey="soil_moisture" stroke="#2563eb" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <Outlet />

        {cropId && <CropChatWidget cropId={cropId} />}
      </div>
    </div>
  );
}