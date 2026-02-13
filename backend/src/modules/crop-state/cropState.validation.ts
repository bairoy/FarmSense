import{z} from "zod";

export const createCropStateSchema = z.object({
  crop_instance_id:z.string().uuid(),
  current_phase:z.string().min(2),
  stress_score:z.number().min(0).max(100).optional()
  
});

export const updateCropStateSchema = z.object({
  current_phase:z.string().min(2).optional(),
  stress_score:z.number().min(0).max(100).optional()
});