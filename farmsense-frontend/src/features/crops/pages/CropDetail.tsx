import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useOutlet,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  Camera,
  ChartLine,
  Droplets,
  Leaf,
  MessageCircle,
  Satellite,
  Sparkles,
  X,
} from "lucide-react";

import { getCropById, updateCrop, getCropTimeline } from "../crop.service";
import type { Crop, TimelineDay } from "../crop.types";
import {
  getRecommendations,
  type RecommendationBundle,
} from "../../recommendations/recommendations.service";
import { RecommendationPanel } from "../../recommendations/RecommendationPanel";
import { CheckinPrompt } from "../../recommendations/CheckinPrompt";
import { ConfidenceBadge } from "../../../components/ConfidenceBadge";
import { ChatPanel } from "../../chat";
/**
 * Recharts is ~350 KB of the bundle and is needed only if the farmer taps
 * "Show timeline". Loading it up front costs every user on a rural connection
 * a chart most of them never open.
 */
const SeasonChart = lazy(() =>
  import("../components/SeasonChart").then((m) => ({ default: m.SeasonChart })),
);
import {
  Alert,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  LoadingPanel,
  PageHeader,
  Skeleton,
  Stat,
  TextField,
} from "../../../components/ui";

export default function CropDetail() {
  const { cropId } = useParams();
  const [searchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "true";

  // Bring the opened sub-page (diagnose, log irrigation, ...) into view.
  const panelRef = useRef<HTMLDivElement>(null);
  const openedChild = useOutlet() !== null;
  const { pathname } = useLocation();
  useEffect(() => {
    if (!openedChild) return;
    // Wait a frame so the child has rendered and the section has its height.
    const id = requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(id);
  }, [pathname, openedChild]);

  const [crop, setCrop] = useState<Crop | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bundle, setBundle] = useState<RecommendationBundle | null>(null);
  const [analysing, setAnalysing] = useState(false);

  const [timeline, setTimeline] = useState<TimelineDay[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [waterModel, setWaterModel] = useState<"depletion" | "paddy">(
    "depletion",
  );

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
      .catch(() => active && setError("Could not load this crop."))
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
    setError(null);
    try {
      setBundle(await getRecommendations(cropId));
    } catch {
      setError("Could not analyse this crop right now. Please try again.");
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
    } catch {
      setError("Could not load the season timeline.");
    } finally {
      setTimelineLoading(false);
    }
  };

  if (loading) return <LoadingPanel label="Loading crop" />;
  if (!crop) return <Alert tone="error">{error ?? "No crop found."}</Alert>;

  const state = bundle?.state;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ to: `/field/${crop.field_id}/crops`, label: "Back to field" }}
        eyebrow="Crop"
        title={<span className="capitalize">{crop.crop_type}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>Sown {crop.sowing_date}</span>
            <Badge tone={crop.status === "active" ? "field" : "neutral"}>
              {crop.status}
            </Badge>
          </span>
        }
      />

      {error && <Alert tone="error">{error}</Alert>}

      {/* The check-in renders nothing unless one is actually due. It sits high
          on the page because it is the cheapest real observation the system
          can get, and it expires. */}
      {cropId && <CheckinPrompt cropId={cropId} />}

      {state && (
        <div className="space-y-3">
          {/* These three numbers all come out of the model, so the badge that
              says how much to trust them belongs with them - not only down in
              the recommendations panel. */}
          <div className="flex justify-end">
            <ConfidenceBadge confidence={state.confidence} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              icon={<Leaf className="h-4 w-4" />}
              label="Growth stage"
              value={state.phase.replace(/_/g, " ")}
              sub={`Day ${state.day_number} · ${state.progress_pct}% of the season`}
            />
            <Stat
              icon={<Activity className="h-4 w-4" />}
              label="Health"
              value={`${state.health_score}/100`}
              sub={state.status.replace(/_/g, " ")}
              tone={
                state.health_score >= 70
                  ? "field"
                  : state.health_score >= 45
                    ? "harvest"
                    : "alert"
              }
            />
            <Stat
              icon={<Droplets className="h-4 w-4" />}
              label="Water"
              value={
                state.water.model === "paddy"
                  ? `${state.water.ponded_depth_mm?.toFixed(0) ?? 0} mm standing`
                  : `${state.water.depletion_mm?.toFixed(0) ?? 0} mm depleted`
              }
              sub={
                state.water.model === "paddy"
                  ? state.water.flooded
                    ? "Field is flooded"
                    : `Dry for ${state.water.dry_days ?? 0} day(s)`
                  : `Stress from ${state.water.RAW_mm?.toFixed(0) ?? "?"} mm`
              }
              tone="water"
            />
          </div>
        </div>
      )}

      {editMode && (
        <Card className="p-5 sm:p-6">
          <CardHeader
            title="Correct the sowing date"
            description="Every growth stage and fertilizer timing is anchored to this date, so changing it recalculates the whole season."
          />
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <TextField
              label="Sowing date"
              type="date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="max-w-52"
            />
            <Button onClick={handleUpdate}>Save date</Button>
          </div>
        </Card>
      )}

      {/* ---- Recommendations ---- */}
      <Card className="p-5 sm:p-6">
        <CardHeader
          icon={<Sparkles className="h-5 w-5" />}
          title="Today's guidance"
          description="Water and fertilizer for this crop, with the confidence behind each number."
          action={
            <Button onClick={handleAnalyse} disabled={analysing}>
              {analysing ? "Analysing..." : bundle ? "Refresh" : "Analyse crop"}
            </Button>
          }
        />

        {!bundle && !analysing && (
          <p className="mt-5 rounded-xl bg-clay-50 p-4 text-sm text-clay-600">
            Nothing is calculated until you ask. The model pulls this
            field&rsquo;s weather, its soil profile and the most recent
            satellite pass, then works out what the crop needs.
          </p>
        )}

        {bundle && (
          <div className="mt-5 space-y-5">
            {state && state.stress_factors.length > 0 && (
              <Alert tone="warning" title="Current stresses">
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {state.stress_factors.map((factor, i) => (
                    <li key={i}>{factor}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {state?.correction.note && (
              <div className="flex gap-3 rounded-xl border border-water-200 bg-water-50 p-4">
                <Satellite className="mt-0.5 h-5 w-5 shrink-0 text-water-600" />
                <div className="text-sm text-water-900">
                  <p className="font-semibold">Satellite check</p>
                  <p className="mt-0.5">{state.correction.note}</p>
                </div>
              </div>
            )}

            <RecommendationPanel bundle={bundle} />

            {state && (
              <p className="text-xs text-clay-500">
                Soil data:{" "}
                {state.soil.source === "soilgrids"
                  ? `ISRIC SoilGrids (${state.soil.textureClass ?? "measured"}, ${state.soil.tawMmPerM.toFixed(0)} mm/m available water)`
                  : "district default — no per-field soil measurement available"}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ---- Actions ---- */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-clay-900">
          Record and check
        </h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            to="diagnose"
            icon={<Camera className="h-5 w-5" />}
            title="Diagnose from a photo"
            body="Photograph an affected leaf and get an identification."
            highlight
          />
          <ActionCard
            to="irrigation/new"
            icon={<Droplets className="h-5 w-5" />}
            title="Log irrigation"
            body="Recording what you watered keeps the water balance honest."
          />
          <ActionCard
            to="fertilizer/new"
            icon={<Leaf className="h-5 w-5" />}
            title="Log fertilizer"
            body="What you applied, and when."
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink to="irrigation" variant="secondary" size="sm">
            Irrigation history
          </ButtonLink>
          <ButtonLink to="fertilizer" variant="secondary" size="sm">
            Fertilizer history
          </ButtonLink>
        </div>
      </section>

      {/* ---- Timeline ---- */}
      <Card className="p-5 sm:p-6">
        <CardHeader
          icon={<ChartLine className="h-5 w-5" />}
          title="Season timeline"
          description="Every simulated day since sowing."
          action={
            timeline.length === 0 ? (
              <Button
                variant="secondary"
                onClick={handleTimeline}
                disabled={timelineLoading}
              >
                {timelineLoading ? "Loading..." : "Show timeline"}
              </Button>
            ) : undefined
          }
        />

        {timeline.length > 0 && (
          <div className="mt-6">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <SeasonChart timeline={timeline} waterModel={waterModel} />
            </Suspense>
          </div>
        )}
      </Card>

      {/* Nested routes: diagnosis, the two logs and their histories. They render
          far below the action cards, so the section scrolls itself into view
          when one opens - otherwise the click appears to do nothing. */}
      <div ref={panelRef} className="scroll-mt-20">
        <Outlet />
      </div>

      {cropId && (
        <>
          <button
            onClick={() => setChatOpen((open) => !open)}
            aria-label={
              chatOpen ? "Close crop assistant" : "Open crop assistant"
            }
            aria-expanded={chatOpen}
            // Sits above the phone tab bar rather than on top of it.
            className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-field-700 text-white shadow-float transition-colors hover:bg-field-800 sm:bottom-6"
          >
            {chatOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <MessageCircle className="h-6 w-6" />
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

function ActionCard({
  to,
  icon,
  title,
  body,
  highlight = false,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex gap-3 rounded-xl border p-4 transition-colors ${
        highlight
          ? "border-field-300 bg-field-50 hover:border-field-500"
          : "border-clay-200 bg-white hover:border-field-300 hover:bg-field-50/40"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          highlight ? "bg-field-700 text-white" : "bg-field-100 text-field-700"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-clay-900">{title}</span>
        <span className="mt-0.5 block text-sm text-clay-600">{body}</span>
      </span>
    </Link>
  );
}
