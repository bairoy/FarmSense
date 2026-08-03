import type { Request, Response } from "../../types/http.ts";
import { supabaseAdmin as supabase } from "../../config/supabase.ts";
import * as satelliteService from "./satellite.service.ts";
import { isCdseConfigured } from "../../config/env.ts";

/** Ownership check - satellite data is field-scoped, not public. */
const assertFieldOwned = async (userId: string, fieldId: string) => {
  const { data } = await supabase
    .from("fields")
    .select("id")
    .eq("id", fieldId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) throw new Error("Field not found or not owned by this user");
};

export const getObservationsHandler = async (req: Request, res: Response) => {
  try {
    await assertFieldOwned(req.user!.id, req.params.fieldId);

    const source = req.query.source as "sentinel1" | "sentinel2" | undefined;
    res.json(await satelliteService.getObservationHistory(req.params.fieldId, source));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
};

/**
 * Triggers a fresh Sentinel-2 pass lookup.
 *
 * Explicitly triggered rather than run on every page load: each call costs a
 * CDSE processing unit against a free quota, and the underlying data only
 * changes every ~5 days.
 */
export const refreshObservationHandler = async (req: Request, res: Response) => {
  try {
    await assertFieldOwned(req.user!.id, req.params.fieldId);

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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/** Runs the Sentinel-1 V-shape flood detection over a rice crop's window. */
export const detectTransplantHandler = async (req: Request, res: Response) => {
  try {
    const { data: crop } = await supabase
      .from("crop_instances")
      .select("id,sowing_date,field_id,fields!inner(id,user_id)")
      .eq("id", req.params.cropId)
      .eq("fields.user_id", req.user!.id)
      .maybeSingle();

    if (!crop) return res.status(404).json({ error: "Crop not found" });

    const result = await satelliteService.observeRiceTransplant(
      (crop as any).field_id,
      (crop as any).sowing_date
    );

    // We report the discrepancy rather than silently rewriting the farmer's
    // sowing date. Changing the anchor date shifts every phase boundary for
    // the season, so it should be an explicit, visible decision.
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
