import type { Request, Response } from "../../types/http.ts";
import * as fusion from "./cropState.fusion.ts";

export const getCropStateHandler = async (req: Request, res: Response) => {
  const result = await fusion.getFusedCropState(req.db!, req.user!.id, req.params.cropId);
  res.json(result);
};

export const getRecommendationsHandler = async (req: Request, res: Response) => {
  const result = await fusion.getRecommendations(req.db!, req.user!.id, req.params.cropId);
  res.json(result);
};

export const getIrrigationHandler = async (req: Request, res: Response) => {
  const result = await fusion.getRecommendations(req.db!, req.user!.id, req.params.cropId);
  res.json({
    irrigation: result.irrigation,
    confidence: result.confidence,
    blocked: result.blocked,
  });
};

export const getFertilizerHandler = async (req: Request, res: Response) => {
  const result = await fusion.getRecommendations(req.db!, req.user!.id, req.params.cropId);
  res.json({
    fertilizer: result.fertilizer,
    confidence: result.confidence,
    blocked: result.blocked,
  });
};
