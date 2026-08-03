// Service-role client: `satellite_observations` has RLS enabled and its policy
// resolves `auth.uid()`, which is null on the anon client. See the equivalent
// note in checkin.service.ts.
import { supabaseAdmin as supabase } from "../../config/supabase.ts";
import { isCdseConfigured } from "../../config/env.ts";
import { fetchNdvi, type Sentinel2Observation } from "./sentinel2.service.ts";
import {
  fetchBackscatter,
  detectTransplant,
  type Sentinel1Observation,
  type TransplantDetection,
} from "./sentinel1.service.ts";

/**
 * Satellite observations are stored raw and separately from `crop_states`.
 *
 * The separation matters: `satellite_observations` holds what the sensor
 * measured, `crop_states` holds what we concluded. If the fusion logic changes
 * next month we can recompute every state from the stored observations without
 * re-querying CDSE. Merging them would make the raw measurement
 * unrecoverable.
 */

const ISO = (d: Date) => d.toISOString().split("T")[0];

/** Fetches a field's boundary, falling back to a small box around the pin. */
const getGeometry = async (fieldId: string) => {
  const { data, error } = await supabase
    .from("fields")
    .select("id,latitude,longitude,boundary")
    .eq("id", fieldId)
    .single();

  if (error || !data) throw new Error("Field not found");

  const field = data as any;
  if (field.boundary) return field.boundary;

  // No traced boundary yet. A ~100m box around the pin is a poor substitute
  // and we say so - the confidence attached to anything derived from it is
  // reduced downstream.
  const d = 0.00045; // ~50 m in degrees at this latitude
  const { latitude: lat, longitude: lon } = field;

  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [lon - d, lat - d],
        [lon + d, lat - d],
        [lon + d, lat + d],
        [lon - d, lat + d],
        [lon - d, lat - d],
      ],
    ],
    _synthetic: true,
  };
};

export const persistObservation = async (
  fieldId: string,
  observation: Sentinel2Observation | Sentinel1Observation
) => {
  const row: Record<string, unknown> = {
    field_id: fieldId,
    observed_date: observation.date,
    source: observation.source,
    usable: observation.usable,
  };

  if (observation.source === "sentinel2") {
    row.ndvi = Number.isFinite(observation.ndvi) ? observation.ndvi : null;
    row.ndwi = Number.isFinite(observation.ndwi) ? observation.ndwi : null;
    row.cloud_cover_pct = Math.round(observation.cloudFraction * 100);
  } else {
    row.backscatter_vh_db = Number.isFinite(observation.vhDb) ? observation.vhDb : null;
    row.backscatter_vv_db = Number.isFinite(observation.vvDb) ? observation.vvDb : null;
    row.likely_flooded = observation.likelyFlooded;
  }

  const { error } = await supabase
    .from("satellite_observations")
    .upsert(row as any, { onConflict: "field_id,observed_date,source" });

  if (error) console.error("Failed to persist satellite observation:", error);
};

/**
 * Pulls the most recent usable Sentinel-2 pass for a field.
 *
 * The lookback window is 12 days rather than the 5-day nominal revisit,
 * because in practice a good fraction of passes are lost to cloud even in the
 * dry season.
 */
export const observeWheatField = async (
  fieldId: string,
  lookbackDays = 12
): Promise<Sentinel2Observation | null> => {
  if (!isCdseConfigured()) return null;

  const geometry = await getGeometry(fieldId);
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - lookbackDays);

  try {
    const observation = await fetchNdvi(geometry, ISO(from), ISO(to));
    if (observation) await persistObservation(fieldId, observation);
    return observation;
  } catch (err) {
    console.warn(`Sentinel-2 observation failed: ${(err as Error).message}`);
    return null;
  }
};

/**
 * Walks a Sentinel-1 time series over the transplanting window and looks for
 * the flooding signature.
 *
 * Sampled at 6-day steps to match the S1C/S1D revisit - asking for a finer
 * step just returns the same acquisition repeatedly and wastes quota.
 */
export const observeRiceTransplant = async (
  fieldId: string,
  reportedSowingDate: string,
  windowDays = 45
): Promise<{ series: Sentinel1Observation[]; detection: TransplantDetection }> => {
  const empty: TransplantDetection = {
    detected: false,
    transplantDate: null,
    minVhDb: null,
    recoveryDb: null,
    confidence: 0,
    explanation: "Copernicus Data Space credentials are not configured.",
  };

  if (!isCdseConfigured()) return { series: [], detection: empty };

  const geometry = await getGeometry(fieldId);

  // Look from three weeks before the reported date to `windowDays` after it.
  // Farmers report transplanting approximately, and the whole point of this
  // check is that the report may be wrong - so the search window has to be
  // wider than the error we are trying to catch.
  const start = new Date(reportedSowingDate);
  start.setDate(start.getDate() - 21);

  const series: Sentinel1Observation[] = [];
  const STEP_DAYS = 6;

  for (let offset = 0; offset < windowDays + 21; offset += STEP_DAYS) {
    const from = new Date(start);
    from.setDate(from.getDate() + offset);

    if (from > new Date()) break;

    const to = new Date(from);
    to.setDate(to.getDate() + STEP_DAYS - 1);

    try {
      const observation = await fetchBackscatter(geometry, ISO(from), ISO(to));
      if (observation?.usable) {
        series.push(observation);
        await persistObservation(fieldId, observation);
      }
    } catch (err) {
      console.warn(`Sentinel-1 step failed at ${ISO(from)}: ${(err as Error).message}`);
    }
  }

  return { series, detection: detectTransplant(series) };
};

/** Most recent stored observation, used for staleness reporting. */
export const getLatestObservation = async (
  fieldId: string,
  source?: "sentinel1" | "sentinel2"
) => {
  let query = supabase
    .from("satellite_observations")
    .select("*")
    .eq("field_id", fieldId)
    .eq("usable", true)
    .order("observed_date", { ascending: false })
    .limit(1);

  if (source) query = query.eq("source", source);

  const { data } = await query;
  return data?.[0] ?? null;
};

export const getObservationHistory = async (
  fieldId: string,
  source?: "sentinel1" | "sentinel2"
) => {
  let query = supabase
    .from("satellite_observations")
    .select("*")
    .eq("field_id", fieldId)
    .order("observed_date", { ascending: true });

  if (source) query = query.eq("source", source);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
};
