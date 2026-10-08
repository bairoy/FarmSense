import {z} from "zod";

export const createIrrigationSchema = z.object({
  crop_instance_id:z.string().uuid(),
  amount:z.number().positive(),
  action_date:z.string().optional(),
  client_request_id:z.string().min(1).optional()

});

export const updateIrrigationSchema = z.object({
  amount:z.number().positive().optional(),
  action_date:z.string().optional()
});

