import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TimelineDay } from "../crop.types";

/**
 * The season timeline.
 *
 * Previously one chart with two y-axes: health score 0-100 on the left, water
 * in millimetres on the right. A dual-axis plot lets whoever chose the scales
 * decide whether the two lines appear to cross, and readers take that crossing
 * as a real event. Here "health fell below the water line" would have been
 * pure artefact of the axis ranges.
 *
 * Two stacked charts on a shared day-number axis instead. Each has one scale,
 * nothing implies a relationship the data does not contain, and the two are
 * still read together because they are vertically aligned.
 */

/* Validated against a white surface: adjacent-pair CVD deltaE 23.5 (protan),
   31.7 normal vision, both above 3:1 contrast. */
const HEALTH = "#377c4d"; // field-600
const WATER = "#226fc8"; // water-600
const THRESHOLD = "#cb322e"; // alert-600

const GRID = "#eae8e2"; // clay-200
const AXIS = "#7d7a72"; // clay-500

const axisProps = {
  stroke: AXIS,
  fontSize: 12,
  tickLine: false,
  axisLine: { stroke: GRID },
};

function TooltipCard({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  unit: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-clay-200 bg-white px-3 py-2 shadow-lift">
      <p className="text-xs font-bold uppercase tracking-wide text-clay-500">
        Day {label}
      </p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-clay-600">{entry.name}</span>
            <span className="ml-auto font-bold tabular text-clay-900">
              {typeof entry.value === "number" ? entry.value.toFixed(0) : entry.value}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({
  title,
  caption,
  legend,
  children,
}: {
  title: string;
  caption: string;
  legend?: { color: string; label: string; dashed?: boolean }[];
  children: React.ReactElement;
}) {
  return (
    <figure className="m-0">
      <figcaption className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h4 className="text-sm font-bold text-clay-900">{title}</h4>

          {/* Two series always get a legend; one is named by the title. */}
          {legend && legend.length > 1 && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {legend.map(({ color, label, dashed }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 text-xs font-medium text-clay-600"
                >
                  <svg width="14" height="4" aria-hidden="true">
                    <line
                      x1="0"
                      y1="2"
                      x2="14"
                      y2="2"
                      stroke={color}
                      strokeWidth="2.5"
                      strokeDasharray={dashed ? "4 3" : undefined}
                    />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-0.5 text-xs text-clay-500">{caption}</p>
      </figcaption>

      <ResponsiveContainer width="100%" height={190}>
        {children}
      </ResponsiveContainer>
    </figure>
  );
}

export function SeasonChart({
  timeline,
  waterModel,
}: {
  timeline: TimelineDay[];
  waterModel: "depletion" | "paddy";
}) {
  const paddy = waterModel === "paddy";

  return (
    <div className="space-y-6">
      <Panel
        title="Crop health"
        caption="0 to 100, from the growth model. Higher is better."
      >
        <LineChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day_number" {...axisProps} />
          <YAxis domain={[0, 100]} {...axisProps} />
          <Tooltip
            content={<TooltipCard unit="" />}
            cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
          />
          <Line
            type="monotone"
            dataKey="health_score"
            name="Health"
            stroke={HEALTH}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
          />
        </LineChart>
      </Panel>

      <Panel
        title={paddy ? "Standing water" : "Root-zone water"}
        caption={
          paddy
            ? "Depth of water standing in the paddy, in mm. A puddled field is modelled by ponded depth, not soil moisture."
            : "Millimetres of water the root zone has lost. Stress begins where depletion crosses the threshold."
        }
        legend={
          paddy
            ? undefined
            : [
                { color: WATER, label: "Depletion" },
                { color: THRESHOLD, label: "Stress threshold", dashed: true },
              ]
        }
      >
        <LineChart data={timeline} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="day_number" {...axisProps} />
          <YAxis {...axisProps} />
          <Tooltip
            content={<TooltipCard unit=" mm" />}
            cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
          />

          {/* The chart once plotted `soil_moisture`, a field the engine no
              longer emits - it silently rendered an empty line. Each water
              model now plots its own real state variable. */}
          {paddy ? (
            <Line
              type="monotone"
              dataKey="ponded_depth_mm"
              name="Standing water"
              stroke={WATER}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="soil_depletion"
                name="Depletion"
                stroke={WATER}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
              />
              <Line
                type="monotone"
                dataKey="RAW"
                name="Stress threshold"
                stroke={THRESHOLD}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
              />
            </>
          )}
        </LineChart>
      </Panel>

      <p className="text-center text-xs text-clay-400">Days since sowing</p>

      <SeasonTable timeline={timeline} paddy={paddy} />
    </div>
  );
}

/**
 * The same data as numbers.
 *
 * A line chart is unreadable to a screen reader and to anyone who cannot
 * separate the two hues, so the figures have to be reachable some other way.
 * Sampled weekly - a row per day is 120 rows nobody reads.
 */
function SeasonTable({
  timeline,
  paddy,
}: {
  timeline: TimelineDay[];
  paddy: boolean;
}) {
  const weekly = timeline.filter((day) => day.day_number % 7 === 0);
  if (weekly.length === 0) return null;

  return (
    <details className="rounded-xl border border-clay-200">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-clay-700 hover:text-clay-900">
        Show these numbers as a table
      </summary>

      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-clay-200 text-xs uppercase tracking-wide text-clay-500">
              <th scope="col" className="py-2 pr-4 font-bold">Day</th>
              <th scope="col" className="py-2 pr-4 font-bold">Stage</th>
              <th scope="col" className="py-2 pr-4 font-bold">Health</th>
              <th scope="col" className="py-2 font-bold">
                {paddy ? "Standing water" : "Depletion / threshold"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-100">
            {weekly.map((day) => (
              <tr key={day.day_number}>
                <td className="py-2 pr-4 tabular text-clay-700">{day.day_number}</td>
                <td className="py-2 pr-4 capitalize text-clay-600">
                  {day.phase.replace(/_/g, " ")}
                </td>
                <td className="py-2 pr-4 tabular font-semibold text-clay-900">
                  {day.health_score.toFixed(0)}
                </td>
                <td className="py-2 tabular text-clay-700">
                  {paddy
                    ? `${day.ponded_depth_mm?.toFixed(0) ?? "—"} mm`
                    : `${day.soil_depletion?.toFixed(0) ?? "—"} / ${
                        day.RAW?.toFixed(0) ?? "—"
                      } mm`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
