import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin, userClient } from "../config/supabase.ts";

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

    // Service-role client: verifying a token is exactly the operation that
    // cannot be performed as the user it is about to identify.
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token or expired token" });
    }

    req.user = data.user;

    // Everything downstream queries through this. Because it carries the
    // user's JWT, `auth.uid()` resolves inside Postgres and RLS policies
    // apply - so a controller that forgets its `.eq("user_id", ...)` filter
    // gets an empty result rather than another farmer's rows.
    req.db = userClient(token);

    next();
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
};
