import { Router } from "express";
import { upload } from "../../middlewares/upload.ts";
import { detectDiseaseHandler } from "../disease/disease.controller.ts";

const router = Router();



router.post(
  "/detect",
  upload.single("file"),
  detectDiseaseHandler
);

export default router;