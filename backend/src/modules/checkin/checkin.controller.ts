import type { Request, Response } from "../../types/http.ts";
import { z } from "zod";
import * as checkinService from "./checkin.service.ts";
import { getFusedCropState } from "../recommendations/cropState.fusion.ts";

const answerSchema = z.object({ answer: z.string().min(1) });

/**
 * Returns the question worth asking right now, creating it if one is due.
 *
 * The client polls this when the farmer opens a crop. If nothing is due it
 * returns null rather than inventing a question - asking for the sake of
 * asking is how you train people to ignore the prompt.
 */
export const getDueCheckinHandler = async (req: Request, res: Response) => {
  try {
    const { cropId } = req.params;

    const pending = await checkinService.getPendingCheckin(req.user!.id, cropId);
    if (pending) return res.json({ due: true, checkin: pending });

    if (!(await checkinService.isCheckinDue(cropId))) {
      return res.json({ due: false, checkin: null });
    }

    const state = await getFusedCropState(req.user!.id, cropId);
    const question = checkinService.selectQuestion(
      state.crop_type,
      state.phase,
      state
    );

    const checkin = await checkinService.createCheckin(cropId, question);
    res.json({ due: true, checkin });
  } catch (err: any) {
    res.status(err.message?.includes("not found") ? 404 : 500).json({ error: err.message });
  }
};

export const answerCheckinHandler = async (req: Request, res: Response) => {
  try {
    const { answer } = answerSchema.parse(req.body);
    const result = await checkinService.recordAnswer(
      req.user!.id,
      req.params.checkinId,
      answer
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const getCheckinHistoryHandler = async (req: Request, res: Response) => {
  try {
    res.json(await checkinService.getCheckinHistory(req.user!.id, req.params.cropId));
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
};
