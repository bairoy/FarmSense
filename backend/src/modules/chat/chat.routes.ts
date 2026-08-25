import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { chatHandler } from "./chat.controller.ts";

const router = Router();
router.use(requireAuth);

router.post("/", asyncHandler(chatHandler));

export default router;
