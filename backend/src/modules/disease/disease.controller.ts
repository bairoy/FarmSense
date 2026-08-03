import type { Request, Response } from "../../types/http.ts";
import * as diseaseService from "./disease.service.ts";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

export const analyseCropImageHandler = async (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }
    if (req.file.size > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: "Image exceeds 12MB" });
    }
    if (!ALLOWED_MIME.has(req.file.mimetype)) {
      return res.status(415).json({ error: `Unsupported image type: ${req.file.mimetype}` });
    }

    const result = await diseaseService.analyseCropImage(
      req.user!.id,
      cropId,
      req.file
    );

    res.status(201).json(result);
  } catch (err: any) {
    console.error("Disease analysis failed:", err.message);

    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Disease detection failed" });
  }
};

export const getCropImagesHandler = async (req: Request, res: Response) => {
  try {
    const images = await diseaseService.getCropImages(
      req.user!.id,
      req.params.cropId
    );
    res.json(images);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
};
