import type { Request, Response } from "../../types/http.ts";
import * as cropStateService from "./cropState.service.ts";
import { createCropStateSchema } from "./cropState.validation.ts";

const handle = async (res: Response, work: () => Promise<unknown>, created = false) => {
  try {
    const result = await work();
    res.status(created ? 201 : 200).json(result);
  } catch (err: any) {
    console.error(err);
    res.status(err.message?.includes("not found") ? 404 : 400).json({ error: err.message });
  }
};

export const createCropStateHandler = (req: Request, res: Response) =>
  handle(
    res,
    async () =>
      cropStateService.createCropState(req.user!.id, createCropStateSchema.parse(req.body)),
    true
  );

export const getCropStatesHandler = (req: Request, res: Response) =>
  handle(res, () => cropStateService.getCropStates(req.user!.id, req.params.cropId));

export const deleteCropStateHandler = (req: Request, res: Response) =>
  handle(res, () => cropStateService.deleteCropState(req.user!.id, req.params.stateId));

export const getCurrentCropStateHandler = (req: Request, res: Response) =>
  handle(res, () => cropStateService.computeCropState(req.user!.id, req.params.cropId));

/**
 * The full simulation.
 *
 * The ownership check now lives in the service. Previously this handler
 * queried the crop itself and passed the result straight into the engine
 * without checking whether the query returned anything - an unowned crop id
 * produced `undefined`, which the engine then dereferenced.
 */
export const getCropTimelineHandler = (req: Request, res: Response) =>
  handle(res, () => cropStateService.getTimeline(req.user!.id, req.params.cropId));
