import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types.ts";
import { env } from "./env.ts";

/**
 * The type every service accepts for its database handle.
 *
 * Both `userClient(...)` and `supabaseAdmin` satisfy it, which is deliberate:
 * a service should not care whether it is running on the request path or in a
 * background job, only that it was handed a client by its caller. What it must
 * never do is reach for a module-level client of its own - that is how the
 * sessionless anon client ended up in eleven modules.
 */
export type Db = SupabaseClient<Database>;

/**
 * Per-request client carrying the caller's access token.
 *
 * This is the whole point of the phase. The anon key alone authenticates as
 * the Postgres `anon` role, where `auth.uid()` is NULL and therefore no
 * row-level policy can tell one farmer from another. Attaching the user's JWT
 * makes `auth.uid()` resolve inside Postgres, which is the precondition for
 * RLS enforcing anything at all.
 *
 * A new client per request is intentional. Sharing one and mutating its auth
 * state would race across concurrent requests and hand one user another
 * user's session - the exact failure this is meant to prevent.
 */
export const userClient = (accessToken: string): Db =>
  createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    // No session to persist or refresh: the token's lifetime is the request's.
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * A throwaway client for one GoTrue credential exchange.
 *
 * `signInWithPassword` and `refreshSession` *store a session on the client they
 * are called on*. Calling them on a shared module-level client therefore leaves
 * that client authenticated as whoever logged in last, and every later
 * PostgREST call through it silently runs as that user.
 *
 * That is not hypothetical: sign-in used to run on `supabaseAdmin`, which meant
 * the first login on a process demoted the service-role client to an ordinary
 * user. Signup's profile insert then failed RLS, and the timeline engine's
 * system writes ran as a farmer. Signup worked exactly once per deploy.
 *
 * A fresh client per exchange has no session to leak - it is discarded with the
 * request, for the same reason `userClient` is built per request.
 */
export const authClient = (): Db =>
  createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Sessionless anon client. **Auth endpoints only.**
 *
 * Named `supabaseAnon` rather than `supabase` on purpose: the short name read
 * like a sensible default and got imported into eleven data modules, each of
 * which was then querying as `anon` with no user attached. `refreshSession`
 * is a legitimate use - it exchanges a refresh token before any user context
 * exists, and goes through GoTrue rather than PostgREST, so RLS is not in
 * play. Anything that touches a table wants `req.db` instead.
 */
export const supabaseAnon = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey
);

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Reserved for two cases: verifying tokens in `requireAuth`, and system-owned
 * writes that have no user session to run under (the timeline engine, the
 * satellite fetcher, the check-in scheduler). Every use site carries a comment
 * saying which of those it is - if one does not, it is a bug.
 */
export const supabaseAdmin = createClient<Database>(
  env.supabaseUrl,
  env.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
