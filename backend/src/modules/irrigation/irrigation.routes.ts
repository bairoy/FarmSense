import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as irrigationController from "./irrigation.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(irrigationController.createIrrigationHandler));
router.get("/:cropId", asyncHandler(irrigationController.getIrrigationHandler));
router.delete("/:irrigationId", asyncHandler(irrigationController.deleteIrrigationHandler));

export default router;
