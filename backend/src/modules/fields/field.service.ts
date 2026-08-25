import type { Db } from "../../config/supabase.ts";
import {
  UNIT_KEYS,
  describeArea,
  polygonAreaSqm,
  polygonCentroid,
  toSquareMetres,
} from "../../utils/landUnits.ts";
import type {
  CreateFieldInput,
  UpdateFieldInput,
} from "./field.validation.ts";

/**
 * Resolves whatever the farmer supplied into one canonical area in m2.
 *
 * Priority is deliberate:
 *   1. A traced boundary polygon - an actual measurement of the ground.
 *   2. An explicit area_sqm - already canonical, no conversion needed.
 *   3. The region's customary units - what farmers know, converted at the edge.
 *
 * Storing one canonical number means no downstream calculation ever has to
 * ask which unit it is holding.
 */
const resolveArea = (input: CreateFieldInput | UpdateFieldInput) => {
  if (input.boundary) {
    const ring = input.boundary.coordinates[0] as [number, number][];
    return { area_sqm: polygonAreaSqm(ring), derived_from: "boundary" as const };
  }

  if (input.area_sqm !== undefined) {
    return { area_sqm: input.area_sqm, derived_from: "area_sqm" as const };
  }

  const supplied = Object.fromEntries(
    UNIT_KEYS.filter((key) => (input as Record<string, unknown>)[key] !== undefined).map(
      (key) => [key, (input as Record<string, number>)[key]]
    )
  );

  if (Object.keys(supplied).length > 0) {
    return {
      area_sqm: toSquareMetres(supplied),
      derived_from: "local_units" as const,
    };
  }

  return null;
};

/**
 * The point we hand to weather and soil APIs.
 *
 * When a boundary exists we use its centroid, not the pin the farmer dropped.
 * The centroid is guaranteed to sit inside the plot; a hand-dropped pin often
 * sits on the road the farmer was standing on.
 */
const resolvePoint = (input: CreateFieldInput | UpdateFieldInput) => {
  if (input.boundary) {
    return polygonCentroid(input.boundary.coordinates[0] as [number, number][]);
  }
  return input.latitude !== undefined && input.longitude !== undefined
    ? { latitude: input.latitude, longitude: input.longitude }
    : null;
};

const buildRow = (input: CreateFieldInput | UpdateFieldInput) => {
  const row: Record<string, unknown> = {};

  if (input.location_name !== undefined) row.location_name = input.location_name;
  if (input.soil_type !== undefined) row.soil_type = input.soil_type;
  if (input.boundary !== undefined) row.boundary = input.boundary;

  const point = resolvePoint(input);
  if (point) {
    row.latitude = point.latitude;
    row.longitude = point.longitude;
  }

  const area = resolveArea(input);
  if (area) {
    row.area_sqm = Number(area.area_sqm.toFixed(2));
    row.area_source = area.derived_from;
    // `area` is the legacy acres column. Kept in sync so nothing that still
    // reads it silently goes stale, but nothing new should use it.
    row.area = Number((area.area_sqm / 4046.8564224).toFixed(4));
  }

  return row;
};

/** Attaches every unit representation so the UI never converts by hand. */
const decorate = (field: any) =>
  field == null
    ? field
    : {
        ...field,
        area: field.area_sqm != null ? describeArea(field.area_sqm) : null,
        area_acres_legacy: field.area,
      };

/**
 * Every function below takes the caller's request-scoped client as its first
 * argument rather than importing a module-level one.
 *
 * The explicit `.eq("user_id", userId)` filters are kept even though RLS now
 * enforces the same thing. They are not redundant: they keep the query
 * intent readable, and if a policy is ever dropped or mis-migrated the app
 * does not silently become multi-tenant-readable. Belt and braces, in the
 * order that matters - the braces are in the database.
 */

export const createField = async (
  db: Db,
  userId: string,
  payload: CreateFieldInput
) => {
  const { data, error } = await db
    .from("fields")
    .insert({ user_id: userId, ...buildRow(payload) } as any)
    .select()
    .single();

  if (error) throw error;
  return decorate(data);
};

export const getAllFields = async (db: Db, userId: string) => {
  const { data, error } = await db
    .from("fields")
    .select("*")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map(decorate);
};

export const getFieldById = async (db: Db, userId: string, fieldId: string) => {
  const { data, error } = await db
    .from("fields")
    .select("*")
    .eq("id", fieldId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;
  return decorate(data);
};

export const updateField = async (
  db: Db,
  userId: string,
  fieldId: string,
  payload: UpdateFieldInput
) => {
  const { data, error } = await db
    .from("fields")
    .update(buildRow(payload) as any)
    .eq("id", fieldId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return decorate(data);
};

export const deleteField = async (db: Db, userId: string, fieldId: string) => {
  const { error } = await db
    .from("fields")
    .delete()
    .eq("id", fieldId)
    .eq("user_id", userId);

  if (error) throw error;
  return { success: true };
};
