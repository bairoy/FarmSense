import { Router } from "express";
import { upload } from "../../middlewares/upload.ts";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as diseaseController from "./disease.controller.ts";

const router = Router();

router.use(requireAuth);

router.post(
  "/crop/:cropId/analyse",
  upload.single("file"),
  asyncHandler(diseaseController.analyseCropImageHandler)
);

router.get("/crop/:cropId/images", asyncHandler(diseaseController.getCropImagesHandler));

export default router;
