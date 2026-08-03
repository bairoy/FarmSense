import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import * as controller from "./checkin.controller.ts";

const router = Router();
router.use(requireAuth);

router.get("/crop/:cropId/due", controller.getDueCheckinHandler);
router.get("/crop/:cropId/history", controller.getCheckinHistoryHandler);
router.post("/:checkinId/answer", controller.answerCheckinHandler);

export default router;
