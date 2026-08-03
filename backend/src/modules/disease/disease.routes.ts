import { Router } from "express";
import { upload } from "../../middlewares/upload.ts";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import * as diseaseController from "./disease.controller.ts";

const router = Router();

// Every route here touches a specific farmer's crop, so authentication is
// applied at the router level rather than per-route - it is then impossible to
// add a new route below and forget it.
router.use(requireAuth);

router.post(
  "/crop/:cropId/analyse",
  upload.single("file"),
  diseaseController.analyseCropImageHandler
);

router.get("/crop/:cropId/images", diseaseController.getCropImagesHandler);

export default router;
