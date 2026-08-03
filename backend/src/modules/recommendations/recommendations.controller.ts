import type { Request, Response } from "../../types/http.ts";
import * as fusion from "./cropState.fusion.ts";

const handle = async (
  res: Response,
  work: () => Promise<unknown>
) => {
  try {
    res.json(await work());
  } catch (err: any) {
    console.error(err);
    const notFound = err.message?.includes("not found");
    res.status(notFound ? 404 : 500).json({ error: err.message });
  }
};

export const getCropStateHandler = (req: Request, res: Response) =>
  handle(res, () => fusion.getFusedCropState(req.user!.id, req.params.cropId));

export const getRecommendationsHandler = (req: Request, res: Response) =>
  handle(res, () => fusion.getRecommendations(req.user!.id, req.params.cropId));

export const getIrrigationHandler = (req: Request, res: Response) =>
  handle(res, async () => {
    const result = await fusion.getRecommendations(req.user!.id, req.params.cropId);
    return {
      irrigation: result.irrigation,
      confidence: result.confidence,
      blocked: result.blocked,
    };
  });

export const getFertilizerHandler = (req: Request, res: Response) =>
  handle(res, async () => {
    const result = await fusion.getRecommendations(req.user!.id, req.params.cropId);
    return {
      fertilizer: result.fertilizer,
      confidence: result.confidence,
      blocked: result.blocked,
    };
  });
