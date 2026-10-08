import { isAxiosError } from "axios";

/**
 * The backend puts a human-readable reason in `error` on the response body;
 * several of those are worth showing verbatim to the farmer. Falls through to
 * the caller's fallback for non-HTTP failures (timeout, no connectivity).
 */
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  if (isAxiosError(err)) {
    const message = err.response?.data?.error;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
};
