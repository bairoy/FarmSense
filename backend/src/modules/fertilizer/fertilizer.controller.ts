import type { Request, Response } from "../../types/http.ts";
import * as fertilizerService from "./fertilizer.service.ts";
import { createFertilizerSchema } from "./fertilizer.validation.ts";

export const createFertilizerHandler = async (req: Request, res: Response) => {
  const body = createFertilizerSchema.parse(req.body);
  const fertilizer = await fertilizerService.createFertilizer(
    req.db!,
    req.user!.id,
    body
  );
  res.status(201).json(fertilizer);
};

export const getFertilizerHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;
  const data = await fertilizerService.getFertilizerByCrop(
    req.db!,
    req.user!.id,
    cropId
  );
  res.json(data);
};

export const deleteFertilizerHandler = async (req: Request, res: Response) => {
  const { fertilizerId } = req.params;
  await fertilizerService.deleteFertilizer(req.db!, req.user!.id, fertilizerId);
  res.json({ success: true });
};
