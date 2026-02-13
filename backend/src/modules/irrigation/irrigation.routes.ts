import {Router} from "express";
import {requireAuth} from "../../middlewares/auth.middleware.ts";
import * as irrigationController from "./irrigation.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/",irrigationController.createIrrigationHandler);
router.get("/:cropId",irrigationController.getIrrigationHandler);
router.delete("/:irrigationId",irrigationController.deleteIrrigationHandler);

export default router;