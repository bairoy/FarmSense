import express from "express";
import authRoutes from "./modules/auth/auth.routes.ts";
import fieldRoutes from "./modules/fields/field.routes.ts";
import cropRoutes from "./modules/crops/crop.routes.ts"

const app = express();
app.use(express.json());
app.use("/api/auth",authRoutes);
app.use("/api/fields",fieldRoutes);
app.use("/api/crops",cropRoutes);

export default app;