import {z} from "zod";

export const createCropSchema = z.object({
  field_id:z.string().uuid(),
  crop_type:z.string().min(2),
  sowing_date:z.string().optional(),
  status:z.enum(["active","harvested","failed"]).optional()
});

export const updateCropSchema = z.object({
  crop_type:z.string().min(2).optional(),
  sowing_date:z.string().optional(),
  irrigation_method:z.string().optional(),
  status:z.enum(["active","harvested","failed"]).optional()
});

