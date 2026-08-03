import type { User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      /** Populated by requireAuth. Absent on unauthenticated routes. */
      user?: User;
    }
  }
}

/**
 * Narrows route parameters to strings.
 *
 * Express 5 types `req.params` values as `string | string[]`, because a
 * wildcard route like `/files/*path` can capture multiple segments. None of
 * our routes do that - every parameter is a single `:id` segment - so without
 * this augmentation every controller has to cast, which buys no safety and
 * adds noise to all of them.
 */
declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: string;
  }
}

export {};
