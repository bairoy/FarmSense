import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as controller from "./satellite.controller.ts";

const router = Router();
router.use(requireAuth);

router.get("/field/:fieldId/observations", asyncHandler(controller.getObservationsHandler));
router.post("/field/:fieldId/refresh", asyncHandler(controller.refreshObservationHandler));
router.get("/crop/:cropId/transplant-detection", asyncHandler(controller.detectTransplantHandler));

export default router;
