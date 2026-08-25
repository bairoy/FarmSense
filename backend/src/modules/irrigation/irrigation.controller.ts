import type { Request, Response } from "../../types/http.ts";
import * as irrigationService from "./irrigation.service.ts";
import { createIrrigationSchema } from "./irrigation.validation.ts";

export const createIrrigationHandler = async (req: Request, res: Response) => {
  const body = createIrrigationSchema.parse(req.body);
  const irrigation = await irrigationService.createIrrigation(
    req.db!,
    req.user!.id,
    body
  );
  res.status(201).json(irrigation);
};

export const getIrrigationHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;
  const data = await irrigationService.getIrrigationByCrop(
    req.db!,
    req.user!.id,
    cropId
  );
  res.json(data);
};

export const deleteIrrigationHandler = async (req: Request, res: Response) => {
  const { irrigationId } = req.params;
  await irrigationService.deleteIrrigation(req.db!, req.user!.id, irrigationId);
  res.json({ success: true });
};
