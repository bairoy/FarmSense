import type { Request, Response } from "../../types/http.ts";
import * as cropStateService from "./cropState.service.ts";
import { createCropStateSchema } from "./cropState.validation.ts";

export const createCropStateHandler = async (req: Request, res: Response) => {
  const result = await cropStateService.createCropState(
    req.db!,
    req.user!.id,
    createCropStateSchema.parse(req.body)
  );
  res.status(201).json(result);
};

export const getCropStatesHandler = async (req: Request, res: Response) => {
  const result = await cropStateService.getCropStates(
    req.db!,
    req.user!.id,
    req.params.cropId
  );
  res.json(result);
};

export const deleteCropStateHandler = async (req: Request, res: Response) => {
  await cropStateService.deleteCropState(req.db!, req.user!.id, req.params.stateId);
  res.json({ success: true });
};

export const getCurrentCropStateHandler = async (req: Request, res: Response) => {
  const result = await cropStateService.computeCropState(
    req.db!,
    req.user!.id,
    req.params.cropId
  );
  res.json(result);
};

export const getCropTimelineHandler = async (req: Request, res: Response) => {
  const result = await cropStateService.getTimeline(
    req.db!,
    req.user!.id,
    req.params.cropId
  );
  res.json(result);
};
