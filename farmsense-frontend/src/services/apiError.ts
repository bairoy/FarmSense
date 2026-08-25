import axios from "axios";

/**
 * The error message to show the farmer for a failed request.
 *
 * The backend puts a human-readable reason in `error` on the response body, and
 * several of those are worth showing verbatim - "Unsupported crop for this
 * region. Supported: rice, wheat" tells someone exactly what to do next, where
 * a generic "something went wrong" does not.
 *
 * Reaching for `err.response.data.error` directly requires typing `err` as
 * `any`, which turns off checking on the whole expression. `isAxiosError` is
 * the narrowing the pattern actually wanted: it confirms there is a `response`
 * before anything reads through it, and leaves non-HTTP failures (a thrown
 * TypeError, an aborted request) falling through to the caller's fallback.
 */
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const message = err.response?.data?.error;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
};
