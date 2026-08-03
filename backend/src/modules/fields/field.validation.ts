import { z } from "zod";

/**
 * A GeoJSON Polygon restricted to what we actually support.
 *
 * A field boundary matters because every satellite step averages pixels over
 * the field extent. A single lat/long point can easily land on a bund, a farm
 * road, or the neighbour's plot - and a 10m Sentinel-2 pixel centred on a road
 * reports a low NDVI that has nothing to do with the crop.
 *
 * Holes (interior rings) are not supported: a Terai paddy plot does not have
 * them, and allowing them would complicate the area maths for no gain.
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
 * Area may be given either as Bigha-Kattha-Dhur or directly in square metres.
 * If a boundary polygon is supplied it wins over both - a traced boundary is a
 * measurement, a typed number is a recollection.
 */
const areaFields = {
  area_sqm: z.number().positive().optional(),
  bigha: z.number().min(0).optional(),
  kattha: z.number().min(0).optional(),
  dhur: z.number().min(0).optional(),
};

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
      v.bigha !== undefined ||
      v.kattha !== undefined ||
      v.dhur !== undefined,
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
