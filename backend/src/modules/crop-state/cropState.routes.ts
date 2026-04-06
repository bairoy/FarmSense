import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import * as cropStateController from "./cropState.controller.ts"

const router = Router();
router.use(requireAuth);
// router.post("/",cropStateController.createCropStateHandler);
router.get("/timeline/:cropId", cropStateController.getCropTimelineHandler);
router.get("/:cropId/current", cropStateController.getCurrentCropStateHandler);

router.get("/:cropId", cropStateController.getCropStatesHandler);

router.delete("/state/:stateId", cropStateController.deleteCropStateHandler);

export default router;