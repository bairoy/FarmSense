import type { Request, Response } from "../../types/http.ts";
import * as diseaseService from "./disease.service.ts";
import { ValidationError, PayloadTooLargeError, UnsupportedMediaError } from "../../utils/errors.ts";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

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

  const result = await diseaseService.analyseCropImage(
    req.db!,
    req.user!.id,
    cropId,
    req.file
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
