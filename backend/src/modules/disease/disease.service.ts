import { differenceInDays } from "date-fns";
import type { Db } from "../../config/supabase.ts";
import { classifyCropImage } from "../../utils/ai.client.ts";
import { getTreatment } from "../rules/treatments.loader.ts";
import {
  buildImageKey,
  uploadImage,
  resolveImageUrl,
} from "../images/r2.storage.ts";
import { isR2Configured } from "../../config/env.ts";
import { statusFromScore } from "../crop-state/timeline.engine.ts";

/**
 * Verifies the crop belongs to this user and returns what we need downstream.
 *
 * Every entry point into crop-scoped data goes through a check like this. The
 * join to `fields` is what enforces ownership - `crop_instances` itself has no
 * user_id column.
 */
const assertCropOwned = async (db: Db, userId: string, cropId: string) => {
  const { data, error } = await db
    .from("crop_instances")
    .select("id,crop_type,sowing_date,fields!inner(user_id)")
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Crop not found or not owned by this user");
  }

  return data;
};

/**
 * The full photo -> diagnosis -> history path.
 *
 * Previously `/detect` classified an image and threw the result away. The
 * README promised health history over time; nothing wrote a row. This function
 * is that missing path:
 *
 *   1. classify (AI service also returns the compressed archival JPEG)
 *   2. store the image in R2, store only its key in Postgres
 *   3. look up a treatment, gated on confidence
 *   4. write a crop_states row so the observation joins the timeline
 *   5. write a crop_images row linked to that state
 *
 * Steps 4 and 5 are what make disease detection part of the digital twin
 * rather than a disconnected demo.
 */
export const analyseCropImage = async (
  db: Db,
  userId: string,
  cropId: string,
  file: { buffer: Buffer; originalname: string }
) => {
  const crop = await assertCropOwned(db, userId, cropId);

  const prediction = await classifyCropImage(file.buffer, file.originalname);
  const treatment = getTreatment(prediction.disease, prediction.confidence);

  // Store the image. If R2 is not configured we still record the diagnosis -
  // losing the photo is bad, losing the observation is worse.
  let imageKey: string | null = null;
  let imageUrl: string | null = null;

  if (isR2Configured()) {
    try {
      imageKey = await uploadImage(buildImageKey(cropId), prediction.image);
      imageUrl = await resolveImageUrl(imageKey);
    } catch (err) {
      console.error("R2 upload failed; keeping diagnosis without image:", err);
    }
  }

  const dayNumber =
    differenceInDays(new Date(), new Date(crop.sowing_date)) + 1;

  // A disease observation is a real, independent measurement of crop health -
  // the same class of thing as a satellite pass. It belongs in crop_states
  // with its source labelled, so the fusion step can weigh it properly.
  const healthScore = scoreFromDiagnosis(prediction);

  const diseased = prediction.disease !== "healthy";

  // Upsert, not insert. The table carries a unique constraint of one state row
  // per crop per day, so a farmer photographing the same crop twice in one day
  // would otherwise hit a duplicate-key error and lose the second diagnosis.
  // The later photo is the more current observation, so it supersedes.
  const { data: state, error: stateError } = await db
    .from("crop_states")
    .upsert({
      crop_instance_id: cropId,
      day_number: dayNumber,
      // `phase` records how this state was obtained, not a growth stage - a
      // photo tells us what the plant looks like, not what phenological stage
      // it is in. The GDD model owns growth stage.
      phase: "observed",
      // Date, not timestamp: the unique constraint is per calendar day.
      recorded_date: new Date().toISOString().split("T")[0],
      source: "disease_model",
      confidence: prediction.confidence,
      health_score: healthScore,
      status: statusFromScore(healthScore),
      // This is a direct sighting of disease on the plant, which is a much
      // stronger signal than the weather-derived risk proxy the rule engine
      // computes. Recorded at full strength when the classifier is confident.
      disease_risk: diseased ? prediction.confidence : 0,
      stress_factors: diseased
        ? [`${prediction.disease.replace(/_/g, " ")} identified from a crop photo`]
        : [],
    }, { onConflict: "crop_instance_id,recorded_date" })
    .select()
    .single();

  if (stateError) {
    console.error("Failed to persist crop_state from diagnosis:", stateError);
  }

  // Written whether or not the image was stored. This row IS the diagnosis
  // record - the photo is only an attachment. Skipping it when R2 is
  // unconfigured left the photo history empty and, worse, hid the diagnosis
  // from the fused crop state, which reads its most recent diagnosis from
  // here to cap the health score.
  const { error: imageError } = await db.from("crop_images").insert({
    crop_instance_id: cropId,
    crop_state_id: state?.id ?? null,
    r2_key: imageKey,
    image_url: imageUrl,
    disease_class: prediction.disease,
    confidence: prediction.confidence,
    health_status: prediction.disease === "healthy" ? "healthy" : "diseased",
    treatment_recommended: treatment.actionable
      ? treatment.treatment.label
      : null,
    original_bytes: prediction.original_bytes,
    stored_bytes: prediction.stored_bytes,
  });

  if (imageError) {
    console.error("Failed to persist diagnosis record:", imageError);
  }

  return {
    crop_instance_id: cropId,
    crop_state_id: state?.id ?? null,
    diagnosis: {
      disease: prediction.disease,
      confidence: prediction.confidence,
      margin: prediction.margin,
      probabilities: prediction.probabilities,
    },
    // The gate result travels with the response so the UI cannot accidentally
    // render a treatment we decided not to stand behind.
    ...treatment,
    image_url: imageUrl,
    health_score: healthScore,
    compression: {
      original_bytes: prediction.original_bytes,
      stored_bytes: prediction.stored_bytes,
      ratio:
        prediction.stored_bytes > 0
          ? Number((prediction.original_bytes / prediction.stored_bytes).toFixed(1))
          : null,
    },
  };
};

/**
 * Maps a diagnosis onto the same 0-100 health scale the rule engine uses.
 *
 * Scaled by confidence so a hesitant "leaf_blast" does not slam the score to
 * 40. An uncertain observation should move the estimate, not dominate it.
 */
const scoreFromDiagnosis = (prediction: {
  disease: string;
  confidence: number;
}): number => {
  const severityFloor: Record<string, number> = {
    healthy: 95,
    brown_spot: 60,
    hispa: 60,
    leaf_blast: 40,
  };

  const floor = severityFloor[prediction.disease] ?? 70;
  if (prediction.disease === "healthy") return floor;

  // Blend between "no damage" (100) and the class floor, weighted by how sure
  // the model is.
  return Math.round(100 - (100 - floor) * prediction.confidence);
};

export const getCropImages = async (db: Db, userId: string, cropId: string) => {
  await assertCropOwned(db, userId, cropId);

  const { data, error } = await db
    .from("crop_images")
    .select("*")
    .eq("crop_instance_id", cropId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  // Keys are stored, not URLs - presigned URLs expire, so they are resolved
  // at read time rather than baked into the row.
  return Promise.all(
    (data ?? []).map(async (row: any) => ({
      ...row,
      image_url: row.r2_key ? await resolveImageUrl(row.r2_key) : row.image_url,
    }))
  );
};
