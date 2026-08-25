// Placeholders for config/env.ts, which throws on a missing Supabase key.
import "./support/testEnv.ts";

import test from "node:test";
import assert from "node:assert/strict";

/**
 * Sign-in must not strand a session on a shared client.
 *
 * `signInWithPassword` and `refreshSession` store the resulting session on the
 * client they are called on. Sign-in used to run on `supabaseAdmin`, so the
 * first login on a process re-authenticated the service-role client as that
 * farmer. Two things broke, both silently:
 *
 *   1. Signup's profile insert started failing RLS, so signup worked exactly
 *      once per deploy and then returned 500 forever.
 *   2. The timeline engine's system-owned writes ran as whichever user had
 *      logged in most recently, rather than bypassing RLS as intended.
 *
 * This test needs no network: it asserts the structural property that made the
 * bug possible - that the auth service does not reach for a shared client.
 */

test("sign-in and refresh do not run on a shared module-level client", async () => {
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(
      new URL("../modules/auth/auth.service.ts", import.meta.url),
      "utf8"
    )
  );

  // The two calls that mutate client auth state.
  for (const method of ["signInWithPassword", "refreshSession"]) {
    const line = source
      .split("\n")
      .find((l) => l.includes(`.auth.${method}(`));

    assert.ok(line, `expected auth.service.ts to call ${method}`);
    assert.match(
      line,
      /authClient\(\)/,
      `${method} must be called on authClient(), not a shared client - ` +
        `a shared client keeps the session and starts acting as that user`
    );
    assert.doesNotMatch(
      line,
      /supabaseAdmin|supabaseAnon/,
      `${method} must never run on supabaseAdmin or supabaseAnon`
    );
  }
});

test("authClient hands back a distinct instance each call", async () => {
  const { authClient } = await import("../config/supabase.ts");

  // Sharing one instance would reintroduce the bug the moment two farmers log
  // in on the same process.
  assert.notEqual(
    authClient(),
    authClient(),
    "authClient() must build a new client per credential exchange"
  );
});

test("the admin client is built from the service role key", async () => {
  const { supabaseAdmin } = await import("../config/supabase.ts");
  const { env } = await import("../config/env.ts");

  // Guards the other half of the invariant: whatever else changes, the client
  // documented as bypassing RLS must actually be the service-role one.
  const key = (supabaseAdmin as unknown as { supabaseKey: string }).supabaseKey;
  assert.equal(key, env.supabaseServiceRoleKey);
  assert.notEqual(key, env.supabaseAnonKey);
});
