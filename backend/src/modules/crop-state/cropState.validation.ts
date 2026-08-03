import { z } from "zod";

/**
 * Manual crop-state entry.
 *
 * `current_phase` is required because a state record with no phase is not
 * interpretable later - the whole point of the history is comparing like with
 * like across the season.
 */
export const createCropStateSchema = z.object({
  crop_instance_id: z.string().uuid(),
  // The live column is `phase`, not `current_phase` - the generated types were
  // stale and claimed otherwise.
  phase: z.string().min(2),
  health_score: z.number().min(0).max(100).optional(),
  water_stress: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});

export const updateCropStateSchema = z.object({
  phase: z.string().min(2).optional(),
  health_score: z.number().min(0).max(100).optional(),
  water_stress: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});
