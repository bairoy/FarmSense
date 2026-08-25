import type { Request, Response } from "../../types/http.ts";
import { z } from "zod";
import * as checkinService from "./checkin.service.ts";
import { getFusedCropState } from "../recommendations/cropState.fusion.ts";
import { ValidationError } from "../../utils/errors.ts";

const answerSchema = z.object({ answer: z.string().min(1) });

export const getDueCheckinHandler = async (req: Request, res: Response) => {
  const { cropId } = req.params;

  const pending = await checkinService.getPendingCheckin(req.user!.id, cropId);

  if (pending) return res.json({ due: true, checkin: pending });

  if (!(await checkinService.isCheckinDue(cropId))) {
    return res.json({ due: false, checkin: null });
  }

  const state = await getFusedCropState(req.db!, req.user!.id, cropId);
  const question = checkinService.selectQuestion(
    state.crop_type,
    state.phase,
    state
  );

  const checkin = await checkinService.createCheckin(cropId, question);
  res.json({ due: true, checkin });
};

export const answerCheckinHandler = async (req: Request, res: Response) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError("Answer is required");
  }
  const result = await checkinService.recordAnswer(
    req.user!.id,
    req.params.checkinId,
    parsed.data.answer
  );
  res.json(result);
};

export const getCheckinHistoryHandler = async (req: Request, res: Response) => {
  const history = await checkinService.getCheckinHistory(req.user!.id, req.params.cropId);
  res.json(history);
};
