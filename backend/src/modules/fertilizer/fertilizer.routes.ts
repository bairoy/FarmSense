import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as fertilizerController from "./fertilizer.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(fertilizerController.createFertilizerHandler));
router.get("/:cropId", asyncHandler(fertilizerController.getFertilizerHandler));
router.delete("/:fertilizerId", asyncHandler(fertilizerController.deleteFertilizerHandler));

export default router;
