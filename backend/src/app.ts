import express from "express";
import authRoutes from "./modules/auth/auth.routes.ts";
import fieldRoutes from "./modules/fields/field.routes.ts";
import cropRoutes from "./modules/crops/crop.routes.ts"
import cropStateRoutes from "./modules/crop-state/cropState.routes.ts"
import irrigationRoutes from "./modules/irrigation/irrigation.routes.ts";
import fertilizerRoutes from "./modules/fertilizer/fertilizer.routes.ts";
import diseaseRoutes from "./modules/disease/disease.routes.ts";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/fields", fieldRoutes);
app.use("/api/crops", cropRoutes);
app.use("/api/crop-states", cropStateRoutes);
app.use("/api/irrigation", irrigationRoutes);
app.use("/api/fertilizer", fertilizerRoutes);
app.use("/api/disease", diseaseRoutes);
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next();
});

export default app;