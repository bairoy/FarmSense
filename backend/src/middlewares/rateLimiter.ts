import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "../types/http.ts";

/**
 * Bucket a request by client IP.
 *
 * `req.ip` is not usable as a limiter key on its own. A single IPv6 customer is
 * routinely handed a whole /64, so keying on the full address lets one attacker
 * rotate through billions of distinct keys and never hit the limit - which is
 * precisely the case the auth limiter exists to stop. `ipKeyGenerator`
 * normalises IPv6 down to its subnet prefix and leaves IPv4 alone.
 *
 * express-rate-limit v8 detects a raw `req.ip` key generator and logs
 * ERR_ERL_KEY_GEN_IPV6 at startup rather than failing, so this was shipping as
 * a warning in the boot log rather than an error.
 */
const ipKey = (req: Request): string =>
  req.ip ? ipKeyGenerator(req.ip) : "unknown";

/**
 * Auth endpoints: 5 requests per 15 minutes per IP.
 * Protects against brute-force login attempts.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Try again in 15 minutes." },
  keyGenerator: ipKey,
});

/**
 * Expensive endpoints (disease detection, chat): 20 requests per hour per user.
 * These cost real GPU/LLM spend, so the key is user ID, not IP.
 */
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded. You can make 20 requests per hour." },
  keyGenerator: (req: Request) => req.user?.id || ipKey(req),
});

/**
 * General API endpoints: 100 requests per minute per IP.
 */
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
  keyGenerator: ipKey,
});
