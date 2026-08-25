import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as cropStateController from "./cropState.controller.ts";

const router = Router();
router.use(requireAuth);

router.post("/", asyncHandler(cropStateController.createCropStateHandler));
router.get("/timeline/:cropId", asyncHandler(cropStateController.getCropTimelineHandler));
router.get("/:cropId/current", asyncHandler(cropStateController.getCurrentCropStateHandler));
router.get("/:cropId", asyncHandler(cropStateController.getCropStatesHandler));
router.delete("/state/:stateId", asyncHandler(cropStateController.deleteCropStateHandler));

export default router;
