import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as cropController from "./crop.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(cropController.createCropHandler));
router.get("/field/:fieldId", asyncHandler(cropController.getCropsByFieldHandler));
router.get("/:cropId", asyncHandler(cropController.getCropHandler));
router.put("/:cropId", asyncHandler(cropController.updateCropHandler));
router.delete("/:cropId", asyncHandler(cropController.deleteCropHandler));

export default router;
