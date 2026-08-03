import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.ts";
import { chatHandler } from "./chat.controller.ts";

const router = Router();
router.use(requireAuth);

router.post("/", chatHandler);

export default router;
