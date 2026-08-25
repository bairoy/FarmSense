import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.ts";
import { getRegionHandler } from "./region.controller.ts";

const router = Router();

/**
 * Unauthenticated on purpose: this is static calibration data with nothing
 * user-specific in it, and the sign-up screen needs the unit labels before
 * anyone has a token.
 */
router.get("/", asyncHandler(getRegionHandler));

export default router;
