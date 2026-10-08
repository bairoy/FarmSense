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
import { ValidationError } from "../../utils/errors.ts";
import { computeCropTimeline, statusFromScore } from "../crop-state/timeline.engine.ts";

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
    .select(
      "id,crop_type,sowing_date,field_id," +
        "fields!inner(id,user_id,latitude,longitude,boundary,area_sqm)"
    )
    .eq("id", cropId)
    .eq("fields.user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Crop not found or not owned by this user");
  }

  return data as any;
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
  file: { buffer: Buffer; originalname: string },
  /** Calendar date (YYYY-MM-DD) the photo was taken. Defaults to today. */
  takenOn?: string,
  /**
   * UUID the mobile client generates once per queued photo. A photo taken
   * offline is retried until it gets a response; without this, a retry after
   * a dropped reply (upload succeeded, the phone never saw the 201) would
   * re-run AI classification and write a second diagnosis. Checked before
   * calling the classifier - the point is to skip the expensive call, not
   * just avoid a duplicate row.
   */
  clientRequestId?: string
) => {
  const crop = await assertCropOwned(db, userId, cropId);
  const photoDate = takenOn ?? new Date().toISOString().split("T")[0];

  if (new Date(photoDate) < new Date(crop.sowing_date)) {
    throw new ValidationError("The photo date is before this crop was sown");
  }

  if (clientRequestId) {
    const { data: existing } = await db
      .from("crop_images")
      .select("*")
      .eq("crop_instance_id", cropId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();

    if (existing) return replayFromStoredImage(existing as any, photoDate);
  }

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

  // Day number and state date come from when the photo was TAKEN, not when it
  // was uploaded: the twin is compared against its own prediction for that day.
  const dayNumber =
    differenceInDays(new Date(photoDate), new Date(crop.sowing_date)) + 1;

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
      recorded_date: photoDate,
      source: "disease_model",
      confidence: prediction.confidence,
      health_score: healthScore,
      status: statusFromScore(healthScore),
      // This is a direct sighting of disease on the plant, which is a much
      // stronger signal than the weather-derived risk proxy the rule engine
      // computes. Recorded at full strength when the classifier is confident.
      // Zero for a photo below the confidence gate. The engine only lets a
      // diagnosis correct the twin when this is positive, so an uncertain
      // classification can never move the simulation.
      disease_risk: diseased && treatment.actionable ? prediction.confidence : 0,
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
    client_request_id: clientRequestId ?? null,
  });

  if (imageError) {
    console.error("Failed to persist diagnosis record:", imageError);
  }

  const twin_correction = await compareWithTwin(crop, photoDate, healthScore, {
    diseased,
    actionable: treatment.actionable,
  });

  return {
    crop_instance_id: cropId,
    crop_state_id: state?.id ?? null,
    taken_on: photoDate,
    twin_correction,
    diagnosis: {
      disease: prediction.disease,
      confidence: prediction.confidence,
      margin: prediction.margin,
      probabilities: prediction.probabilities,
      // A data URI the clients can drop straight into <img src>. Not persisted:
      // it can be regenerated from the stored photo, so a replayed response
      // carries null.
      heatmap: prediction.heatmap_b64
        ? `data:image/jpeg;base64,${prediction.heatmap_b64}`
        : null,
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
 * What the twin thought of the crop on the day the photo was taken, and whether
 * the photo changed that.
 *
 * Runs the same simulation the dashboard uses, after the photo has been stored,
 * so the answer reflects the correction the engine actually applied rather than
 * a separate calculation that could disagree with it.
 */
const compareWithTwin = async (
  crop: any,
  photoDate: string,
  observedHealth: number,
  photo: { diseased: boolean; actionable: boolean }
) => {
  try {
    const result = await computeCropTimeline(crop);
    const day = result.timeline.find((d) => d.date === photoDate);
    if (!day) return null;

    const applied = result.correction.photo_observations.find(
      (o) => o.date === photoDate
    );

    if (applied) {
      return {
        adjusted: true,
        date: photoDate,
        simulated_health: applied.simulated_health,
        observed_health: observedHealth,
        corrected_health: applied.corrected_health,
        note: applied.note,
      };
    }

    const note = !photo.actionable
      ? "The classifier was not confident enough, so this photo did not change the crop estimate."
      : photo.diseased
        ? "The crop estimate for that day already showed similar stress, so it was left unchanged."
        : "The photo shows no disease, which matches the crop estimate for that day. It does not rule out water stress, so nothing was changed.";

    return {
      adjusted: false,
      date: photoDate,
      simulated_health: Math.round(day.health_score),
      observed_health: observedHealth,
      corrected_health: Math.round(day.health_score),
      note,
    };
  } catch (err) {
    console.error("Twin comparison failed:", err);
    return null;
  }
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
    // Provisional twin-tuning values for the classes added with the v2 model;
    // like the treatment entries they have not been agronomically reviewed.
    // Classes not listed (leaf_scald, leaf_smut, narrow_brown_spot) use the
    // default below.
    tungro: 40,
    bacterial_leaf_blight: 45,
    sheath_blight: 55,
  };

  const floor = severityFloor[prediction.disease] ?? 70;
  if (prediction.disease === "healthy") return floor;

  // Blend between "no damage" (100) and the class floor, weighted by how sure
  // the model is.
  return Math.round(100 - (100 - floor) * prediction.confidence);
};

/**
 * Rebuilds a response for a photo that was already analysed under this
 * `client_request_id`, instead of re-running the classifier.
 *
 * `crop_images` does not carry everything the original response had (the
 * twin comparison and per-class probabilities are computed, not stored), so
 * a replayed response is a strict subset - enough to confirm to the farmer
 * that the photo was received and diagnosed, not a byte-for-byte replay.
 */
const replayFromStoredImage = (image: Record<string, any>, photoDate: string) => ({
  crop_instance_id: image.crop_instance_id,
  crop_state_id: image.crop_state_id,
  taken_on: photoDate,
  twin_correction: null,
  diagnosis: {
    disease: image.disease_class,
    confidence: image.confidence,
    margin: null,
    probabilities: null,
    heatmap: null,
  },
  actionable: image.treatment_recommended !== null,
  treatment: image.treatment_recommended ? { label: image.treatment_recommended } : null,
  image_url: image.image_url,
  health_score: null,
  compression: {
    original_bytes: image.original_bytes,
    stored_bytes: image.stored_bytes,
    ratio:
      image.stored_bytes > 0
        ? Number((image.original_bytes / image.stored_bytes).toFixed(1))
        : null,
  },
  replayed: true,
});

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
