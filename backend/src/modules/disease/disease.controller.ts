import type { Request, Response } from "../../types/http.ts";
import * as diseaseService from "./disease.service.ts";
import { ValidationError, PayloadTooLargeError, UnsupportedMediaError } from "../../utils/errors.ts";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const MAX_PHOTO_AGE_DAYS = 90;

/**
 * The date the photo was taken. Optional (defaults to today), but when given it
 * must be a real past-or-present date inside a window the twin can still be
 * corrected over - a future date would be a photo of a crop that does not yet
 * look like that.
 */
const parseTakenOn = (raw: unknown): string | undefined => {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("taken_on must be a date in YYYY-MM-DD format");
  }
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("taken_on is not a valid date");
  }
  const todayUtc = new Date(new Date().toISOString().split("T")[0] + "T00:00:00Z");
  if (date > todayUtc) {
    throw new ValidationError("The photo date cannot be in the future");
  }
  const ageDays = (todayUtc.getTime() - date.getTime()) / 86_400_000;
  if (ageDays > MAX_PHOTO_AGE_DAYS) {
    throw new ValidationError(`The photo date cannot be more than ${MAX_PHOTO_AGE_DAYS} days ago`);
  }
  return raw;
};

export const analyseCropImageHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;

  if (!req.file) {
    throw new ValidationError("No image uploaded");
  }
  if (req.file.size > MAX_UPLOAD_BYTES) {
    throw new PayloadTooLargeError("Image exceeds 12MB");
  }
  if (!ALLOWED_MIME.has(req.file.mimetype)) {
    throw new UnsupportedMediaError(`Unsupported image type: ${req.file.mimetype}`);
  }

  const takenOn = parseTakenOn(req.body?.taken_on);
  const clientRequestId =
    typeof req.body?.client_request_id === "string" && req.body.client_request_id.length > 0
      ? req.body.client_request_id
      : undefined;

  const result = await diseaseService.analyseCropImage(
    req.db!,
    req.user!.id,
    cropId,
    req.file,
    takenOn,
    clientRequestId
  );

  res.status(201).json(result);
};

export const getCropImagesHandler = async (req: Request, res: Response) => {
  const images = await diseaseService.getCropImages(
    req.db!,
    req.user!.id,
    req.params.cropId
  );
  res.json(images);
};
