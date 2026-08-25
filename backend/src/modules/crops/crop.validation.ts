import { z } from "zod";
import { loadActiveRegion } from "../rules/rules.loader.ts";

/**
 * Only crops the active region actually has a calibration for.
 *
 * The engine looks up `region.crops[crop_type]` and falls back to rice when the
 * key is missing. That fallback is invisible: a crop saved as "Basmati rice"
 * would be modelled with the rice Kc curve and report no error, so the farmer
 * gets a confident timeline for a crop the system was never told about.
 * Rejecting the value at the edge is the only place this can be caught loudly.
 */
const regionCrops = Object.keys(loadActiveRegion().crops);

const cropType = z
  .string()
  .refine((value) => regionCrops.includes(value), {
    message: `Unsupported crop for this region. Supported: ${regionCrops.join(", ")}`,
  });

export const createCropSchema = z.object({
  field_id: z.string().uuid(),
  crop_type: cropType,
  // Required, not optional. Every growth stage, Kc value and fertilizer
  // timing is anchored to this date - a crop without one cannot be modelled
  // at all.
  sowing_date: z.string().min(1),
  irrigation_method: z.string().optional(),
  status: z.enum(["active", "harvested", "failed"]).optional(),
});

export const updateCropSchema = z.object({
  crop_type: cropType.optional(),
  sowing_date:z.string().optional(),
  irrigation_method:z.string().optional(),
  status:z.enum(["active","harvested","failed"]).optional()
});

