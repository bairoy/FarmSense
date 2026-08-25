import type { Request, Response } from "../../types/http.ts";
import type { Db } from "../../config/supabase.ts";
import * as satelliteService from "./satellite.service.ts";
import { isCdseConfigured } from "../../config/env.ts";
import { NotFoundError } from "../../utils/errors.ts";

/**
 * Ownership check - satellite data is field-scoped, not public.
 *
 * Runs on the request-scoped client, not the service-role one. The gate is
 * meaningless if the query that enforces it is the query that bypasses RLS.
 * The fetch it guards still runs as admin, because writing an observation row
 * is a system action with no user session behind it.
 */
const assertFieldOwned = async (db: Db, userId: string, fieldId: string) => {
  const { data } = await db
    .from("fields")
    .select("id")
    .eq("id", fieldId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new NotFoundError("Field");
};

export const getObservationsHandler = async (req: Request, res: Response) => {
  await assertFieldOwned(req.db!, req.user!.id, req.params.fieldId);
  const source = req.query.source as "sentinel1" | "sentinel2" | undefined;
  res.json(await satelliteService.getObservationHistory(req.params.fieldId, source));
};

export const refreshObservationHandler = async (req: Request, res: Response) => {
  await assertFieldOwned(req.db!, req.user!.id, req.params.fieldId);

  if (!isCdseConfigured()) {
    return res.status(503).json({
      error:
        "Copernicus Data Space credentials are not configured. Satellite correction is unavailable; crop states will report lower confidence.",
    });
  }

  const observation = await satelliteService.observeWheatField(req.params.fieldId);

  if (!observation) {
    return res.json({
      observation: null,
      note: "No Sentinel-2 acquisition was available in the lookback window.",
    });
  }

  res.json({
    observation,
    note: observation.usable
      ? null
      : `Acquisition found but ${(observation.cloudFraction * 100).toFixed(0)}% cloud-obscured, so it cannot be used for correction.`,
  });
};

export const detectTransplantHandler = async (req: Request, res: Response) => {
  const { data: crop } = await req.db!
    .from("crop_instances")
    .select("id,sowing_date,field_id,fields!inner(id,user_id)")
    .eq("id", req.params.cropId)
    .eq("fields.user_id", req.user!.id)
    .maybeSingle();

  if (!crop) throw new NotFoundError("Crop");

  const result = await satelliteService.observeRiceTransplant(
    (crop as any).field_id,
    (crop as any).sowing_date
  );

  const reported = new Date((crop as any).sowing_date);
  const detected = result.detection.transplantDate
    ? new Date(result.detection.transplantDate)
    : null;

  const offsetDays = detected
    ? Math.round((detected.getTime() - reported.getTime()) / 86_400_000)
    : null;

  res.json({
    ...result.detection,
    reported_sowing_date: (crop as any).sowing_date,
    offset_days: offsetDays,
    suggestion:
      offsetDays !== null && Math.abs(offsetDays) >= 7
        ? `Radar suggests the field was flooded ${Math.abs(offsetDays)} days ${offsetDays > 0 ? "after" : "before"} the recorded sowing date. Every growth-stage estimate is anchored to that date - consider correcting it.`
        : null,
    observations: result.series.length,
  });
};
