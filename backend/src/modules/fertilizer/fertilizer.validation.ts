import {z} from "zod";

export const createFertilizerSchema = z.object({
  crop_instance_id: z.string().uuid(),
  fertilizer_type:z.string().min(2),
  quantity:z.number().positive(),
  action_date:z.string().optional()
});

export const updateFertilizerSchema = z.object({
  fertilizer_type:z.string().min(2).optional(),
  quantity:z.number().positive().optional(),
  action_date:z.string().optional()
});