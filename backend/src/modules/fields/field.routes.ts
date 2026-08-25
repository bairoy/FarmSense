import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as fieldController from "./field.controller.ts";

const router = Router();

router.use(requireAuth);

router.post("/", asyncHandler(fieldController.createFieldHandler));
router.get("/", asyncHandler(fieldController.getFieldsHandler));
router.get("/:fieldId", asyncHandler(fieldController.getFieldHandler));
router.put("/:fieldId", asyncHandler(fieldController.udpateFieldHandler));
router.delete("/:fieldId", asyncHandler(fieldController.deleteFieldHandler));

export default router;
