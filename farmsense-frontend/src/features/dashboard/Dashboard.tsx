// import { useAuthStore } from "../../store/authStore";
// import { useNavigate } from "react-router-dom";
// import { Link } from "react-router-dom";
// import { useState } from "react";

// export default function Dashboard() {
//   const logout = useAuthStore((state) => state.logout);
//   const user = useAuthStore((state) => state.user);
//   const navigate = useNavigate();
//   const [showDisease, setShowDisease] = useState(false);
//   const [selectedFile, setSelectedFile] = useState<File | null>(null);
//   const [diseaseResult, setDiseaseResult] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const handleLogout = () => {
//     console.log("logout clicked");
//     logout();
//     navigate("/login");
//   };
//   const handleDetectDisease = async () => {
//     if (!selectedFile) return;

//     try {
//       setLoading(true);

//       const formData = new FormData();
//       formData.append("file", selectedFile);

//       const res = await fetch("http://localhost:3000/api/disease/detect", {
//         method: "POST",
//         body: formData
//       });

//       const data = await res.json();
//       setDiseaseResult(data);

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };


//   return (
//     <div className="flex items-center justify-center min-h-screen bg-green-50">
//       <div className="bg-white p-8 rounded shadow w-96 text-center space-y-4">
//         <h2 className="text-2xl font-bold">Dashboard</h2>

//         <p className="text-gray-600">
//           Welcome {user?.name}
//         </p>

//         <div className="flex flex-col gap-3 mt-4">
//           <Link
//             to="/fields"
//             className="bg-green-600 text-white px-4 py-2 rounded"
//           >
//             View Fields
//           </Link>

//           <Link
//             to="/fields/new"
//             className="bg-blue-600 text-white px-4 py-2 rounded"
//           >
//             Add Field
//           </Link>
//         </div>
//         <button
//           onClick={() => setShowDisease(true)}
//           className="bg-purple-600 text-white px-4 py-2 rounded"
//         >
//           Detect Disease
//         </button>

//         {showDisease && (
//           <div className="mt-4 p-4 border rounded bg-gray-100">
//             <h3 className="font-semibold mb-2">Upload Crop Image</h3>

//             <input
//               type="file"
//               onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
//             />

//             <button
//               onClick={handleDetectDisease}
//               className="bg-green-600 text-white px-4 py-2 mt-2 rounded"
//             >
//               Detect
//             </button>

//             {loading && <p className="mt-2">Detecting...</p>}

//             {diseaseResult && (
//               <div className="mt-4 p-3 border rounded bg-red-50">
//                 <p><strong>Disease:</strong> {diseaseResult.disease}</p>
//                 <p>
//                   <strong>Confidence:</strong>{" "}
//                   {(diseaseResult.confidence * 100).toFixed(1)}%
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//         <button
//           onClick={handleLogout}
//           className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
//         >
//           Logout
//         </button>
//       </div>
//     </div>
//   );

// }
import { useAuthStore } from "../../store/authStore";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { useState } from "react";

export default function Dashboard() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [showDisease, setShowDisease] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [diseaseResult, setDiseaseResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    console.log("logout clicked");
    logout();
    navigate("/login");
  };

  const handleDetectDisease = async () => {
    if (!selectedFile) return;

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("http://localhost:3000/api/disease/detect", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      setDiseaseResult(data);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 pt-24 pb-10 px-6">

      {/* HERO SECTION */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="relative rounded-3xl overflow-hidden shadow-md border border-green-100">

          {/* Background Image */}
          <img
            src="https://images.unsplash.com/photo-1577283640779-66bb84010b18?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="rice and wheat farm"
            className="w-full h-[320px] object-cover"
          />

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-900/80 via-green-800/60 to-transparent" />

          {/* Content */}
          <div className="absolute inset-0 flex items-center">
            <div className="px-8 md:px-12 max-w-xl text-white">

              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Precision Farming for
                <span className="block text-yellow-300">
                  Rice & Wheat 🌾
                </span>
              </h1>

              <p className="mt-4 text-lg text-green-100">
                Welcome back, <span className="font-semibold">{user?.name}</span>.
                Detect diseases early, monitor crop health, and improve yield with AI-powered insights.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/fields"
                  className="bg-white text-green-800 px-5 py-2.5 rounded-lg font-medium hover:bg-green-100 transition"
                >
                  View Fields
                </Link>

                <Link
                  to="/fields/new"
                  className="bg-yellow-500 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-yellow-600 transition"
                >
                  Add Field
                </Link>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* GRID SECTION */}
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-6">

        {/* DISEASE DETECTION */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden hover:shadow-md transition">

          <img
            src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449"
            className="w-full h-40 object-cover"
          />

          <div className="p-6">
            <h2 className="text-xl font-semibold text-green-800">
              Rice & Wheat Disease Detection 🧠
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              Identify leaf diseases in paddy and wheat crops using AI-powered analysis.
            </p>

            <button
              onClick={() => setShowDisease(true)}
              className="mt-4 w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-800 transition"
            >
              Upload Crop Image
            </button>

            {showDisease && (
              <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
                <input
                  type="file"
                  className="w-full text-sm"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                />

                <button
                  onClick={handleDetectDisease}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                >
                  Detect Disease
                </button>

                {loading && (
                  <p className="text-sm text-gray-600">Analyzing crop...</p>
                )}

                {diseaseResult && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm">
                    <p><strong>Disease:</strong> {diseaseResult.disease}</p>
                    <p>
                      <strong>Confidence:</strong>{" "}
                      {(diseaseResult.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* INSIGHTS CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 overflow-hidden hover:shadow-md transition">

          <img
            src="https://images.unsplash.com/photo-1500382017468-9049fed747ef"
            className="w-full h-40 object-cover"
          />

          <div className="p-6">
            <h2 className="text-xl font-semibold text-green-800">
              Smart Crop Insights 🌿
            </h2>

            <p className="text-sm text-gray-600 mt-2">
              Get actionable insights specifically for rice and wheat cultivation —
              from disease prevention to yield optimization.
            </p>

            <div className="mt-4 text-sm text-green-700 leading-relaxed">
              • Paddy leaf disease monitoring <br />
              • Wheat rust detection <br />
              • AI-driven crop recommendations <br />
              • Early risk identification
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}