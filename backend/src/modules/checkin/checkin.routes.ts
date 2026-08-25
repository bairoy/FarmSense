import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as controller from "./checkin.controller.ts";

const router = Router();
router.use(requireAuth);

router.get("/crop/:cropId/due", asyncHandler(controller.getDueCheckinHandler));
router.get("/crop/:cropId/history", asyncHandler(controller.getCheckinHistoryHandler));
router.post("/:checkinId/answer", asyncHandler(controller.answerCheckinHandler));

export default router;
