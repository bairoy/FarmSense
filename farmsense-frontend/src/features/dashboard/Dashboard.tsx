import { useAuthStore } from "../../store/authStore";
import { Link } from "react-router-dom";

export default function Dashboard() {
  // Logout lives in the Header component - the local handler here was
  // orphaned when the old inline dashboard markup was replaced.
  const user = useAuthStore((state) => state.user);

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
              Rice & Wheat Disease Detection
            </h2>

            <p className="text-sm text-gray-600 mt-1">
              Identify leaf diseases in paddy and wheat crops
            </p>

            <p className="mt-4 text-sm text-gray-500">
              Open a crop and use <strong>Diagnose from photo</strong>. The result
              is saved to that crop's health history, and no treatment is shown
              unless the model is confident enough to stand behind it.
            </p>

            <Link
              to="/fields"
              className="mt-4 block text-center w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-800 transition"
            >
              Go to my fields
            </Link>
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