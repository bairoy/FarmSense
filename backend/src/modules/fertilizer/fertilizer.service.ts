import type { Db } from "../../config/supabase.ts";

export const createFertilizer = async (
  db: Db,
  userId: string,
  payload: {
    crop_instance_id: string;
    fertilizer_type: string;
    quantity: number;
    action_date?: string;
  }
) => {
  const { data: crop, error: cropError } = await db
    .from("crop_instances")
    .select(`id,fields!inner(user_id)`)
    .eq("id", payload.crop_instance_id)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (cropError || !crop) {
    throw new Error("Crop not found or unauthorized");
  }

  // Stored as an ISO date string. Passing a Date object relies on incidental
  // JSON serialisation and does not match the column type.
  const actionDate = (
    payload.action_date ? new Date(payload.action_date) : new Date()
  ).toISOString();

  const { data, error } = await db
    .from("fertilizer_actions")
    .insert({
      crop_instance_id: payload.crop_instance_id,
      fertilizer_type: payload.fertilizer_type,
      quantity: payload.quantity,
      action_date: actionDate,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const getFertilizerByCrop = async (
  db: Db,
  userId: string,
  cropId: string
) => {
  const { data: crop } = await db
    .from("crop_instances")
    .select(`id, fields!inner(user_id)`)
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (!crop) throw new Error("crop not found");

  const { data, error } = await db
    .from("fertilizer_actions")
    .select("*")
    .eq("crop_instance_id", cropId)
    .order("action_date", { ascending: false });

  if (error) throw error;
  return data;
};

export const deleteFertilizer = async (
  db: Db,
  userId: string,
  fertilizerId: string
) => {
  const { data: fertilizer, error } = await db
    .from("fertilizer_actions")
    .select(
      `
    id,
    crop_instance_id,
    crop_instances!inner(fields!inner(user_id))`
    )
    .eq("id", fertilizerId)
    .eq("crop_instances.fields.user_id", userId)
    .maybeSingle();

  if (error || !fertilizer) {
    throw new Error("Fertilizer entry not found");
  }

  const { error: deleteError } = await db
    .from("fertilizer_actions")
    .delete()
    .eq("id", fertilizerId);

  if (deleteError) throw deleteError;
  return { success: true };
};
