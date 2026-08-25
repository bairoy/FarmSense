import type { Request, Response, NextFunction } from "express";

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Wraps an async route handler so rejected promises go to the error handler.
 *
 * Without this, a thrown error inside an async handler is an unhandled
 * rejection rather than a caught Express error, so it never reaches the
 * central error handler and the request hangs.
 */
export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
