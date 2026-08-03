import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import * as controller from "./satellite.controller.ts";

const router = Router();
router.use(requireAuth);

router.get("/field/:fieldId/observations", controller.getObservationsHandler);
router.post("/field/:fieldId/refresh", controller.refreshObservationHandler);
router.get("/crop/:cropId/transplant-detection", controller.detectTransplantHandler);

export default router;
