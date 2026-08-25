import { z } from "zod";
import { UNIT_KEYS } from "../../utils/landUnits.ts";

/**
 * A GeoJSON Polygon restricted to what we actually support.
 *
 * A field boundary matters because every satellite step averages pixels over
 * the field extent. A single lat/long point can easily land on a bund, a farm
 * road, or the neighbour's plot - and a 10m Sentinel-2 pixel centred on a road
 * reports a low NDVI that has nothing to do with the crop.
 *
 * Holes (interior rings) are not supported: a smallholder paddy plot does not
 * have them, and allowing them would complicate the area maths for no gain.
 */
const coordinate = z.tuple([
  z.number().min(-180).max(180), // longitude first, per GeoJSON
  z.number().min(-90).max(90),
]);

export const boundarySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(z.array(coordinate).min(4))
    .length(1, "Only a single exterior ring is supported"),
});

/**
 * Area may be given either in the region's customary units or directly in
 * square metres. If a boundary polygon is supplied it wins over both - a traced
 * boundary is a measurement, a typed number is a recollection.
 *
 * The customary unit fields are generated from the active region's unit ladder
 * rather than being listed literally, so a region whose units are named
 * differently does not need this file edited to accept them.
 */
const customaryUnitFields = Object.fromEntries(
  UNIT_KEYS.map((key) => [key, z.number().min(0).optional()])
) as Record<string, z.ZodOptional<z.ZodNumber>>;

const areaFields = {
  area_sqm: z.number().positive().optional(),
  ...customaryUnitFields,
};

/** True when the payload carries at least one customary unit component. */
const hasCustomaryUnits = (v: Record<string, unknown>) =>
  UNIT_KEYS.some((key) => v[key] !== undefined);

export const createFieldSchema = z
  .object({
    location_name: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    soil_type: z.string().min(2),
    boundary: boundarySchema.optional(),
    ...areaFields,
  })
  .refine(
    (v) =>
      v.boundary !== undefined ||
      v.area_sqm !== undefined ||
      hasCustomaryUnits(v),
    { message: "Provide either a boundary polygon or a field area" }
  );

export const updateFieldSchema = z.object({
  location_name: z.string().min(2).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  soil_type: z.string().min(2).optional(),
  boundary: boundarySchema.optional(),
  ...areaFields,
});

export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
