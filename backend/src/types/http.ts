import type { Request as ExpressRequest, Response, NextFunction } from "express";

/**
 * Express `Request` with route parameters typed as plain strings.
 *
 * Express 5 types `req.params` values as `string | string[]`, because a
 * wildcard route (`/files/*path`) can capture several segments at once. None
 * of our routes use wildcards - every parameter is a single `:id` segment - so
 * the union is noise that would force a cast in every controller.
 *
 * Fixing it here, once, keeps the controllers readable. If a wildcard route is
 * ever added it must not use this type.
 */
export type Request = ExpressRequest<Record<string, string>>;

export type { Response, NextFunction };
