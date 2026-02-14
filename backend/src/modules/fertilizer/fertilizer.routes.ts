import {Router} from "express";
import {requireAuth} from "../../middlewares/auth.middleware.ts";
import * as fertilizerController from "./fertilizer.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/",fertilizerController.createFertilizerHandler);
router.get("/:cropId",fertilizerController.getFertilizerHandler);
router.delete("/:fertilizerId",fertilizerController.deleteFertilizerHandler);

export default router;