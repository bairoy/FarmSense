/**
 * Placeholder environment for tests that transitively import `config/env.ts`.
 *
 * `config/env.ts` throws on a missing Supabase variable. That is deliberate - a
 * container with no credentials should refuse to start rather than fail on the
 * first farmer's request - but it also means a pure-function test can be taken
 * down by an import three modules away. `recommendations.test.ts` reaches
 * `config/env.ts` through `sentinel1.service.ts` -> `cdse.client.ts` without
 * using a single environment value, and so failed to load at all in CI, where
 * there is no `.env`. That took roughly a quarter of the suite with it.
 *
 * Import this FIRST, before any module that might reach config/env.ts.
 *
 * `??=` so a real `.env` or a genuinely configured CI secret always wins; these
 * only fill gaps. Nothing here is a credential, and nothing using them reaches
 * the network - tests that need a real database check `process.env` themselves
 * and skip (see ownership.test.ts).
 */

process.env.SUPABASE_URL ??= "https://test.supabase.co";
process.env.SUPABASE_PUBLISHABLE_OR_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
