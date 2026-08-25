import type { Db } from "../../config/supabase.ts";
import { differenceInDays } from "date-fns";
import { computeCropTimeline, statusFromScore } from "./timeline.engine.ts";
import { getFusedCropState } from "../recommendations/cropState.fusion.ts";

const loadOwnedCrop = async (db: Db, userId: string, cropId: string) => {
  const { data, error } = await db
    .from("crop_instances")
    .select(
      "id,crop_type,sowing_date,field_id," +
        "fields!inner(id,user_id,latitude,longitude,boundary,area_sqm)"
    )
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("Crop not found or not owned by this user");
  return data as any;
};

/**
 * Manual crop-state entry.
 *
 * This route was commented out, which meant nothing could ever write to
 * `crop_states` - the "health history over time" feature had no write path at
 * all. It is re-enabled here with `source` recorded, so a manually entered
 * state is distinguishable from a simulated or satellite-corrected one.
 */
export const createCropState = async (
  db: Db,
  userId: string,
  payload: {
    crop_instance_id: string;
    phase: string;
    health_score?: number;
    water_stress?: boolean;
    notes?: string;
  }
) => {
  const crop = await loadOwnedCrop(db, userId, payload.crop_instance_id);
  const dayNumber = differenceInDays(new Date(), new Date(crop.sowing_date)) + 1;

  const { data, error } = await db
    .from("crop_states")
    .insert({
      crop_instance_id: payload.crop_instance_id,
      day_number: dayNumber,
      phase: payload.phase,
      health_score: payload.health_score,
      status:
        payload.health_score != null
          ? statusFromScore(payload.health_score)
          : null,
      water_stress: payload.water_stress ?? null,
      recorded_date: new Date().toISOString(),
      source: "farmer_reported",
      // A farmer standing in the field is a good observer of what a plant
      // looks like, so this is high but not certain.
      confidence: 0.8,
      notes: payload.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getCropStates = async (db: Db, userId: string, cropId: string) => {
  await loadOwnedCrop(db, userId, cropId);

  const { data, error } = await db
    .from("crop_states")
    .select("*")
    .eq("crop_instance_id", cropId)
    .order("recorded_date", { ascending: false });

  if (error) throw error;
  return data;
};

export const deleteCropState = async (db: Db, userId: string, stateId: string) => {
  const { data: state, error } = await db
    .from("crop_states")
    .select("id,crop_instance_id,crop_instances!inner(fields!inner(user_id))")
    .eq("id", stateId)
    .eq("crop_instances.fields.user_id", userId)
    .maybeSingle();

  if (error || !state) throw new Error("Crop state not found");

  const { error: deleteError } = await db
    .from("crop_states")
    .delete()
    .eq("id", stateId);

  if (deleteError) throw deleteError;
  return { success: true };
};

/**
 * Today's state.
 *
 * Delegates to the fusion layer rather than computing anything itself, so this
 * endpoint and the recommendation endpoints can never disagree.
 */
export const computeCropState = (db: Db, userId: string, cropId: string) =>
  getFusedCropState(db, userId, cropId);

/** The full day-by-day simulation, for charting. */
export const getTimeline = async (db: Db, userId: string, cropId: string) => {
  const crop = await loadOwnedCrop(db, userId, cropId);
  return computeCropTimeline(crop);
};
