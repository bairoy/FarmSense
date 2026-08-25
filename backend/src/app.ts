import express from "express";
import cors from "cors";
import helmet from "helmet";

import authRoutes from "./modules/auth/auth.routes.ts";
import fieldRoutes from "./modules/fields/field.routes.ts";
import cropRoutes from "./modules/crops/crop.routes.ts";
import cropStateRoutes from "./modules/crop-state/cropState.routes.ts";
import irrigationRoutes from "./modules/irrigation/irrigation.routes.ts";
import fertilizerRoutes from "./modules/fertilizer/fertilizer.routes.ts";
import diseaseRoutes from "./modules/disease/disease.routes.ts";
import recommendationRoutes from "./modules/recommendations/recommendations.routes.ts";
import satelliteRoutes from "./modules/satellite/satellite.routes.ts";
import checkinRoutes from "./modules/checkin/checkin.routes.ts";
import chatRoutes from "./modules/chat/chat.routes.ts";
import regionRoutes from "./modules/region/region.routes.ts";

import { aiServiceHealthy } from "./utils/ai.client.ts";
import { isR2Configured, isCdseConfigured } from "./config/env.ts";
import { supabaseAdmin } from "./config/supabase.ts";
import { errorHandler } from "./middlewares/errorHandler.ts";
import {
  authLimiter,
  expensiveLimiter,
  generalLimiter,
} from "./middlewares/rateLimiter.ts";

const app = express();

// Security headers
app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

// General rate limit for all routes
app.use(generalLimiter);

/**
 * Reports which optional integrations are actually wired up.
 *
 * Useful during setup, but it also matters operationally: a running server
 * with CDSE unconfigured produces crop states that are never satellite-
 * corrected, and this is the fastest way to see that is the case rather than
 * wondering why confidence is stuck at "low".
 */
app.get("/api/health", async (_req, res) => {
  let dbOk = false;
  try {
    const { error } = await supabaseAdmin.from("users").select("id").limit(1);
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  res.json({
    status: dbOk ? "ok" : "degraded",
    database: dbOk,
    integrations: {
      ai_service: await aiServiceHealthy(),
      r2_storage: isR2Configured(),
      copernicus_satellite: isCdseConfigured(),
    },
  });
});

// Auth routes with stricter rate limiting
app.use("/api/auth", authLimiter, authRoutes);

// Region calibration - public, static, no user data.
app.use("/api/region", regionRoutes);

// Standard routes
app.use("/api/fields", fieldRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/crop-states", cropStateRoutes);
app.use("/api/irrigation", irrigationRoutes);
app.use("/api/fertilizer", fertilizerRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/satellite", satelliteRoutes);
app.use("/api/checkins", checkinRoutes);

// Expensive routes with per-user rate limiting
app.use("/api/disease", expensiveLimiter, diseaseRoutes);
app.use("/api/chat", expensiveLimiter, chatRoutes);

// Central error handler - must be last
app.use(errorHandler);

export default app;
