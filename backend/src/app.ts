import express from "express";
import cors from "cors";

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

import { aiServiceHealthy } from "./utils/ai.client.ts";
import { isR2Configured, isCdseConfigured } from "./config/env.ts";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

/**
 * Reports which optional integrations are actually wired up.
 *
 * Useful during setup, but it also matters operationally: a running server
 * with CDSE unconfigured produces crop states that are never satellite-
 * corrected, and this is the fastest way to see that is the case rather than
 * wondering why confidence is stuck at "low".
 */
app.get("/api/health", async (_req, res) => {
  res.json({
    status: "ok",
    integrations: {
      ai_service: await aiServiceHealthy(),
      r2_storage: isR2Configured(),
      copernicus_satellite: isCdseConfigured(),
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/fields", fieldRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/crop-states", cropStateRoutes);
app.use("/api/irrigation", irrigationRoutes);
app.use("/api/fertilizer", fertilizerRoutes);
app.use("/api/disease", diseaseRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/satellite", satelliteRoutes);
app.use("/api/checkins", checkinRoutes);
app.use("/api/chat", chatRoutes);

app.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next(err);
});

export default app;
