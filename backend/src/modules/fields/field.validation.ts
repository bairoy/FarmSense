import {z} from "zod";

export const createFieldSchema = z.object({
  location_name: z.string().min(2),
  latitude:z.number(),
  longitude:z.number(),
  soil_type:z.string().min(2),
  area:z.number().positive().optional()
});

export const updateFieldSchema = z.object({
  location_name:z.string().min(2).optional(),
  latitude:z.number().optional(),
  longitude:z.number().optional(),
  soil_type:z.string().min(2).optional(),
  area:z.number().positive().optional()

});