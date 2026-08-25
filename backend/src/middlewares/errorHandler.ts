import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.ts";
import { MulterError } from "multer";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // JSON parse errors
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format" });
  }

  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.issues.map((e) => e.message).join(", ");
    return res.status(400).json({ error: message });
  }

  // Multer errors (file upload)
  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File too large. Maximum size is 12MB." });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Too many files. Maximum is 1." });
    }
    return res.status(400).json({ error: err.message });
  }

  // Multer fileFilter rejection
  if (err.message?.startsWith("Unsupported image type:")) {
    return res.status(415).json({ error: err.message });
  }

  // Our application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      console.error(`[${err.requestId}] Non-operational error:`, err);
    }
    return res.status(err.statusCode).json({
      error: err.message,
      requestId: err.requestId,
    });
  }

  // Supabase/Postgres errors
  if (err.code === "PGRST116") {
    return res.status(404).json({ error: "Resource not found" });
  }
  if (err.code === "23505") {
    return res.status(409).json({ error: "Resource already exists" });
  }
  if (err.code === "23503") {
    return res.status(400).json({ error: "Referenced resource does not exist" });
  }

  // Unknown errors - log detail, return generic message
  const requestId = Math.random().toString(36).slice(2, 10);
  console.error(`[${requestId}] Unhandled error:`, err);
  return res.status(500).json({
    error: "An unexpected error occurred",
    requestId,
  });
};
