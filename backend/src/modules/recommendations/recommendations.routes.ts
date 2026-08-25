import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as controller from "./recommendations.controller.ts";

const router = Router();
router.use(requireAuth);

router.get("/:cropId/state", asyncHandler(controller.getCropStateHandler));
router.get("/:cropId", asyncHandler(controller.getRecommendationsHandler));
router.get("/:cropId/irrigation", asyncHandler(controller.getIrrigationHandler));
router.get("/:cropId/fertilizer", asyncHandler(controller.getFertilizerHandler));

export default router;
