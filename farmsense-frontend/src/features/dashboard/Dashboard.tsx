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

  //   return (
  //     <div className="flex items-center justify-center min-h-screen bg-green-50">
  //       <div className="bg-white p-8 rounded shadow w-96 text-center">
  //         <h2 className="text-2xl font-bold">Dashboard</h2>
  //         <p className="mt-2 text-gray-600">
  //           Welcome {user?.name}
  //         </p>

  //         <button
  //           onClick={handleLogout}
  //           className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
  //         >
  //           Logout
  //         </button>
  //         <Link
  //   to="/fields/new"
  //   className="bg-green-600 text-white px-4 py-2 rounded"
  // >
  //   Add Field
  // </Link>
  //       </div>
  //     </div>
  //   );
  return (
    <div className="flex items-center justify-center min-h-screen bg-green-50">
      <div className="bg-white p-8 rounded shadow w-96 text-center space-y-4">
        <h2 className="text-2xl font-bold">Dashboard</h2>

        <p className="text-gray-600">
          Welcome {user?.name}
        </p>

        <div className="flex flex-col gap-3 mt-4">
          <Link
            to="/fields"
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            View Fields
          </Link>

          <Link
            to="/fields/new"
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Add Field
          </Link>
        </div>
        <button
          onClick={() => setShowDisease(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded"
        >
          Detect Disease
        </button>

        {showDisease && (
          <div className="mt-4 p-4 border rounded bg-gray-100">
            <h3 className="font-semibold mb-2">Upload Crop Image</h3>

            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            />

            <button
              onClick={handleDetectDisease}
              className="bg-green-600 text-white px-4 py-2 mt-2 rounded"
            >
              Detect
            </button>

            {loading && <p className="mt-2">Detecting...</p>}

            {diseaseResult && (
              <div className="mt-4 p-3 border rounded bg-red-50">
                <p><strong>Disease:</strong> {diseaseResult.disease}</p>
                <p>
                  <strong>Confidence:</strong>{" "}
                  {(diseaseResult.confidence * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleLogout}
          className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );

}