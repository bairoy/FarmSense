import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase.ts";

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token or expired token" });
    }
    // Attach user to request
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
};
