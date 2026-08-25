import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import * as authController from "./auth.controller.ts";

const router = Router();

router.post("/signup", asyncHandler(authController.signupHandler));
router.post("/login", asyncHandler(authController.loginHandler));
router.post("/refresh", asyncHandler(authController.refreshHandler));

export default router;
