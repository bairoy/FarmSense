import type { Request, Response } from "../../types/http.ts";
import * as cropService from "./crop.service.ts";
import { createCropSchema, updateCropSchema } from "./crop.validation.ts";

export const createCropHandler = async (req: Request, res: Response) => {
  const body = createCropSchema.parse(req.body);
  const crop = await cropService.createCropInstance(req.db!, req.user!.id, body);
  res.status(201).json(crop);
};

export const getCropsByFieldHandler = async (req: Request, res: Response) => {
  const { fieldId } = req.params;
  const crops = await cropService.getCropsByField(req.db!, req.user!.id, fieldId);
  res.json(crops);
};

export const getCropHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;
  const crop = await cropService.getCropById(req.db!, req.user!.id, cropId);
  res.json(crop);
};

export const updateCropHandler = async (req: Request, res: Response) => {
  const body = updateCropSchema.parse(req.body);
  const { cropId } = req.params;
  const crop = await cropService.updateCrop(req.db!, req.user!.id, cropId, body);
  res.json(crop);
};

export const deleteCropHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;
  await cropService.deleteCrop(req.db!, req.user!.id, cropId);
  res.json({ success: true });
};
