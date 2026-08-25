import { useEffect, useState } from "react";
import { useParams, useSearchParams, Outlet, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

import { getCropById, updateCrop, getCropTimeline } from "../crop.service";
import type { Crop } from "../crop.types";
import {
  getRecommendations,
  type RecommendationBundle,
} from "../../recommendations/recommendations.service";
import { RecommendationPanel } from "../../recommendations/RecommendationPanel";
import { CheckinPrompt } from "../../recommendations/CheckinPrompt";
import { ConfidenceBadge } from "../../../components/ConfidenceBadge";
import { ChatPanel } from "../../chat";
import type { TimelineDay } from "../crop.types";

export default function CropDetail() {
  const { cropId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  const [crop, setCrop] = useState<Crop | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);

  const [bundle, setBundle] = useState<RecommendationBundle | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [waterModel, setWaterModel] = useState<"depletion" | "paddy">("depletion");

  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    if (!cropId) return;
    let active = true;

    setLoading(true);
    getCropById(cropId)
      .then((data) => {
        if (!active) return;
        setCrop(data);
        setDate(data?.sowing_date ?? "");
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cropId]);

  const handleUpdate = async () => {
    if (!cropId) return;
    await updateCrop(cropId, { sowing_date: date });
    setCrop(await getCropById(cropId));
    // Sowing date anchors the entire GDD model, so anything already computed
    // from the old date is now stale.
    setBundle(null);
    setTimeline([]);
  };

  const handleAnalyse = async () => {
    if (!cropId) return;
    setAnalysing(true);
    try {
      setBundle(await getRecommendations(cropId));
    } catch (err) {
      console.error(err);
    } finally {
      setAnalysing(false);
    }
  };

  const handleTimeline = async () => {
    if (!cropId) return;
    setTimelineLoading(true);
    try {
      const result = await getCropTimeline(cropId);
      setTimeline(result.timeline ?? []);
      setWaterModel(result.water_model ?? "depletion");
    } catch (err) {
      console.error(err);
    } finally {
      setTimelineLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-700">
        Loading crop data...
      </div>
    );
  }

  if (!crop) return <div className="p-8">No crop found</div>;

  const state = bundle?.state;

  return (
    <div className="min-h-screen bg-green-50 px-4 sm:px-6 pt-24 pb-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER */}
        <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-3xl font-bold text-green-800 capitalize">
                {crop.crop_type} 🌾
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Sown {crop.sowing_date} · status {crop.status}
              </p>
            </div>
            {state && <ConfidenceBadge confidence={state.confidence} />}
          </div>

          {state && (
            <div className="mt-5 grid sm:grid-cols-3 gap-4">
              <Stat
                label="Growth stage"
                value={state.phase.replace(/_/g, " ")}
                sub={`day ${state.day_number} · ${state.progress_pct}% of season`}
              />
              <Stat
                label="Health"
                value={`${state.health_score}/100`}
                sub={state.status.replace("_", " ")}
              />
              <Stat
                label="Water"
                value={
                  state.water.model === "paddy"
                    ? `${state.water.ponded_depth_mm?.toFixed(0) ?? 0} mm standing`
                    : `${state.water.depletion_mm?.toFixed(0) ?? 0} mm depleted`
                }
                sub={
                  state.water.model === "paddy"
                    ? state.water.flooded
                      ? "flooded"
                      : `dry ${state.water.dry_days ?? 0} day(s)`
                    : `stress from ${state.water.RAW_mm?.toFixed(0) ?? "?"} mm`
                }
              />
            </div>
          )}
        </div>

        {cropId && <CheckinPrompt cropId={cropId} />}

        {/* EDIT */}
        {editMode && (
          <div className="bg-white p-5 rounded-2xl border border-green-100 shadow-sm">
            <h3 className="font-semibold text-green-800 mb-2">Update Sowing Date</h3>
            <p className="text-xs text-gray-500 mb-3">
              Every growth stage and fertilizer timing is anchored to this date.
            </p>
            <div className="flex gap-3 items-center flex-wrap">
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
          <NavButton to="diagnose" className="bg-emerald-600 hover:bg-emerald-700">
            📷 Diagnose from photo
          </NavButton>
          <NavButton to="fertilizer" className="bg-blue-600 hover:bg-blue-700">
            Fertilizer History
          </NavButton>
          <NavButton to="fertilizer/new" className="bg-green-600 hover:bg-green-700">
            Log Fertilizer
          </NavButton>
          <NavButton to="irrigation" className="bg-blue-600 hover:bg-blue-700">
            Irrigation History
          </NavButton>
          <NavButton to="irrigation/new" className="bg-purple-600 hover:bg-purple-700">
            Log Irrigation
          </NavButton>
        </div>

        {/* RECOMMENDATIONS */}
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
          <button
            onClick={handleAnalyse}
            disabled={analysing}
            className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg transition"
          >
            {analysing ? "Analysing..." : "Analyse crop & get recommendations"}
          </button>

          {bundle && (
            <div className="mt-6 space-y-5">
              {state && state.stress_factors.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm">
                  <p className="font-medium text-orange-900">Current stresses</p>
                  <ul className="mt-2 list-disc ml-5 space-y-1 text-orange-900">
                    {state.stress_factors.map((factor, i) => (
                      <li key={i}>{factor}</li>
                    ))}
                  </ul>
                </div>
              )}

              {state?.correction.note && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-900">
                  <p className="font-medium">Satellite check</p>
                  <p className="mt-1">{state.correction.note}</p>
                </div>
              )}

              <RecommendationPanel bundle={bundle} />

              {state && (
                <p className="text-xs text-gray-500">
                  Soil data:{" "}
                  {state.soil.source === "soilgrids"
                    ? `ISRIC SoilGrids (${state.soil.textureClass ?? "measured"}, ${state.soil.tawMmPerM.toFixed(0)} mm/m available water)`
                    : "district default — no per-field soil measurement available"}
                </p>
              )}
            </div>
          )}
        </div>

        {/* TIMELINE */}
        <div className="bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
          <button
            onClick={handleTimeline}
            disabled={timelineLoading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition"
          >
            {timelineLoading ? "Loading..." : "Show season timeline"}
          </button>

          {timeline.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-semibold mb-1 text-green-800">
                Season timeline 📈
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {waterModel === "paddy"
                  ? "Rice: standing water depth in mm. A paddy is modelled by ponded depth, not soil moisture."
                  : "Wheat: root-zone depletion in mm. Stress begins where depletion crosses RAW."}
              </p>

              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day_number" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />

                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="health_score"
                    name="Health"
                    stroke="#16a34a"
                    dot={false}
                  />

                  {/* The chart previously plotted `soil_moisture`, a field the
                      engine no longer emits - it silently rendered an empty
                      line. Each water model now plots its own real state
                      variable. */}
                  {waterModel === "paddy" ? (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="ponded_depth_mm"
                      name="Standing water (mm)"
                      stroke="#2563eb"
                      dot={false}
                    />
                  ) : (
                    <>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="soil_depletion"
                        name="Depletion (mm)"
                        stroke="#2563eb"
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="RAW"
                        name="Stress threshold (mm)"
                        stroke="#dc2626"
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <Outlet />
      </div>

      {/* Chat button and panel */}
      {cropId && (
        <>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="fixed bottom-4 right-4 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition flex items-center justify-center z-40"
            aria-label={chatOpen ? "Close chat" : "Open chat"}
          >
            {chatOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path
                  fillRule="evenodd"
                  d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path
                  fillRule="evenodd"
                  d="M4.848 2.771A49.144 49.144 0 0 1 12 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 0 1-3.476.383.39.39 0 0 0-.297.17l-2.755 4.133a.75.75 0 0 1-1.248 0l-2.755-4.133a.39.39 0 0 0-.297-.17 48.9 48.9 0 0 1-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97Z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <ChatPanel
            cropId={cropId}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-green-50 rounded-xl p-4">
      <p className="text-xs text-gray-600 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold text-green-900 capitalize mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function NavButton({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`${className} text-white px-4 py-2 rounded-lg transition text-sm`}
    >
      {children}
    </Link>
  );
}
