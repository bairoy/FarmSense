import express from "express";
import authRoutes from "./modules/auth/auth.routes.ts";
import fieldRoutes from "./modules/fields/field.routes.ts";
import cropRoutes from "./modules/crops/crop.routes.ts"
import cropStateRoutes from "./modules/crop-state/cropState.routes.ts"
const app = express();
app.use(express.json());

app.use("/api/auth",authRoutes);
app.use("/api/fields",fieldRoutes);
app.use("/api/crops",cropRoutes);
app.use("/api/crop-states",cropStateRoutes)

app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }
  next();
});

export default app;