import {Router} from "express";
import {requireAuth} from "../../middlewares/auth.middleware.ts";
import * as cropController from "./crop.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/",cropController.createCropHandler);
router.get("/field/:fieldId",cropController.getCropsByFieldHandler);
router.get("/:cropId",cropController.getCropHandler);
router.put("/:cropId",cropController.updateCropHandler);
router.delete("/:cropId",cropController.deleteCropHandler);

export default router;

