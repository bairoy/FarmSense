import {z} from "zod";

export const createCropSchema = z.object({
  field_id: z.string().uuid(),
  crop_type: z.string().min(2),
  // Required, not optional. Every growth stage, Kc value and fertilizer
  // timing is anchored to this date - a crop without one cannot be modelled
  // at all.
  sowing_date: z.string().min(1),
  irrigation_method: z.string().optional(),
  status: z.enum(["active", "harvested", "failed"]).optional(),
});

export const updateCropSchema = z.object({
  crop_type:z.string().min(2).optional(),
  sowing_date:z.string().optional(),
  irrigation_method:z.string().optional(),
  status:z.enum(["active","harvested","failed"]).optional()
});

