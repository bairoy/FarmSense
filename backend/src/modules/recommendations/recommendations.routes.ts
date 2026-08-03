import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import * as controller from "./recommendations.controller.ts";

const router = Router();
router.use(requireAuth);

// The fused state every other endpoint here derives from.
router.get("/:cropId/state", controller.getCropStateHandler);

// The full bundle. Prefer this over the individual endpoints - one request,
// and everything in it is guaranteed to have come from the same state.
router.get("/:cropId", controller.getRecommendationsHandler);

router.get("/:cropId/irrigation", controller.getIrrigationHandler);
router.get("/:cropId/fertilizer", controller.getFertilizerHandler);

export default router;
