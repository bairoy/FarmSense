import {Router} from "express";
import * as authController from "./auth.controller.ts";
const router = Router();
router.post("/signup",authController.signupHandler);
router.post("/login",authController.loginHandler);
router.post("/refresh",authController.refreshHandler);
export default router;