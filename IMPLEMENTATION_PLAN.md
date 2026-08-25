# FarmSense — Implementation Plan

**Status as of 2026-08-03.** Backend `npm run typecheck` is clean and all 90 tests
pass. What follows is not a list of bugs — it is the work between a correct
prototype and a system that can hold a real farmer's data.

Phases are ordered by dependency, not by ambition. Phase 1 is the spine;
Phases 2–3 are cheap and independent; Phases 4–7 grow the surface.

---

## The finding that orders everything

Eleven of fourteen backend modules query Supabase through the **anon-key client
with no user session attached**:

```
field.service.ts:1      crop.service.ts:1       irrigation.service.ts:1
fertilizer.service.ts:2 cropState.service.ts:1  disease.service.ts:2
cropState.fusion.ts:2   timeline.engine.ts:2    (+ auth.service.ts:2)
```

That client authenticates as the Postgres `anon` role. Inside the database
`auth.uid()` is `NULL`, so **no row-level policy can distinguish one user from
another**. It works today only because RLS is disabled on every table these
modules touch.

Two consequences:

1. **Tenant isolation rests entirely on hand-written `.eq("user_id", …)`
   filters.** There is no second line of defense. One omission in any of eleven
   modules is a cross-tenant data leak, and the anon key those modules carry is
   a credential Supabase designs to be publicly shareable.
2. **Turning RLS on breaks all eleven modules at once** — every query would
   return zero rows. So the client refactor must land *before* the policies, in
   the same change set.

This is why Phase 1 is atomic and why it comes first.

### Current RLS coverage

| Table | RLS | Ownership column |
|---|---|---|
| `satellite_observations` | ✅ enabled | `user_id` |
| `farmer_checkins` | ✅ enabled | `user_id` |
| `fields` | ❌ **off** | `user_id` *(nullable)* |
| `crop_instances` | ❌ **off** | `field_id` → `fields.user_id` *(nullable)* |
| `crop_states` | ❌ **off** | `crop_instance_id` → … *(nullable)* |
| `irrigation_actions` | ❌ **off** | `crop_instance_id` → … *(nullable)* |
| `fertilizer_actions` | ❌ **off** | `crop_instance_id` → … *(nullable)* |
| `crop_images` | ❌ **off** | `crop_instance_id` → … *(nullable)* |
| `users` | ❌ **off** | `id` |

Only the two newest tables — the ones that arrived with a migration — are
protected. The seven older tables were created through the dashboard and exist
nowhere in the repo.

---

## Phase 0 — Commit what exists ✅ done (`0093de2`)

Landed as a single commit rather than the split below — 127 files,
+13,972/−2,407.

- [x] 46 modified + 25 untracked files are unversioned, including entire modules
      (`chat/`, `checkin/`, `satellite/`, `recommendations/`, `images/`,
      `tests/`).
- [ ] Split into reviewable commits:
      1. rules engine + the 6 test files
      2. satellite + checkin modules
      3. chat + recommendations modules
      4. frontend changes
- [ ] Confirm the deletion of `backend/src/modules/rules/agronomic.rules.json`
      is intentional — `rules.loader.ts` still exists; verify it now reads
      `regions/gorakhpur.json` and `fertilizer.rates.json` instead.

Nothing below is reviewable, revertible, or safe to build on until this is done.

---

## Phase 1 — Data access foundation ✅ COMPLETE

**All migrations applied. RLS is in force. 8/8 ownership tests pass.**

The application code is done and verified: `npm run typecheck` is clean and
90/90 existing tests pass. All three migrations have been pushed to production
(2026-08-03). Row-level security is now active on all seven core tables.

An ownership test suite was run once against the live project before that
guard existed. It confirmed the finding directly: **the sessionless anon
client could read all 11 rows of `public.users`, including real email
addresses.** Every other isolation case passed, i.e. the hand-written
`.eq("user_id", …)` filters do work — they are just the only thing working.

### 1.1 Request-scoped Supabase client ✅

Add to `backend/src/config/supabase.ts`:

```ts
export const userClient = (accessToken: string) =>
  createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
```

- [x] In `auth.middleware.ts`, after `getUser(token)` succeeds, attach
      `req.db = userClient(token)`.
- [x] Add `db: SupabaseClient<Database>` to `backend/src/types/express.d.ts`.

`auth.uid()` now resolves inside Postgres. Only then can a policy enforce
anything.

Also renamed the old `supabase` export to **`supabaseAnon`**. The short name
read like a sensible default, which is how it ended up in eleven data modules;
the long one forces every remaining use to be deliberate. Its only legitimate
caller is `auth.service.ts:refreshSession`, which runs before any user context
exists and goes through GoTrue rather than PostgREST.

### 1.2 Thread the client through the services ✅

- [x] Change each service signature from `(userId, …)` to `(db, userId, …)`;
      controllers pass `req.db`.
- [x] Files: `fields`, `crops`, `irrigation`, `fertilizer`, `crop-state`,
      `disease`, `recommendations/cropState.fusion`.
- [x] **Keep `supabaseAdmin` deliberately** in `timeline.engine.ts`,
      `checkin.service.ts`, `satellite.service.ts`. Comment added at each
      stating why it is admin.
- [x] `satellite.controller.ts` **moved off** `supabaseAdmin` — its two
      queries are the ownership gate itself, and a gate enforced by the client
      that bypasses RLS is not a gate. The fetch it guards still runs as admin.

Two things surfaced while doing this, both fixed in passing:

- `crop.service.ts:81` had `throw Error` — the bare constructor, not an
  instance — so a failed crop update threw the function object and produced an
  error with no message.
- Two dead imports (`zod/v4/locales` in `crop.service.ts`, `zustand` in
  `fertilizer.controller.ts`).

The riskiest edit was `timeline.engine.ts:176`, which read `irrigation_actions`
through the anon client. Under RLS that returns an empty set rather than an
error, so the water balance would have silently drifted dry with nothing in the
logs. It now uses `supabaseAdmin`, matching `getDaysSinceCheckin` directly
below it — the engine runs both on the request path and from the check-in
scheduler, which has no session to borrow.

### 1.3 Backfill the schema into migrations ⚠️ reconstructed, not dumped

- [x] `backend/supabase/migrations/20260101000000_baseline.sql` — all seven
      tables, timestamped ahead of `20260801000000_digital_twin.sql`.
- [ ] **`npx supabase db dump` was not run** — it needs the database password.
      The file was reconstructed from `database.types.ts`, which is generated
      from the live schema and so is authoritative on columns and types but
      says nothing about foreign keys or defaults. Replace it wholesale once
      credentials are available.
- [ ] Verify `npx supabase db reset` rebuilds the database from zero.

Two constraints were confirmed behaviourally rather than read off a dump:
`fields.user_id → auth.users(id) on delete cascade` exists, and
`public.users → auth.users` **does not** — deleting an auth user removed that
user's fields but left an orphaned profile row behind. 1.4 closes that gap.

### 1.4 NOT NULL constraints — must precede RLS ✅ written

Every ownership column in the table above is **nullable**. Under RLS,
`auth.uid() = NULL` evaluates to `NULL`, not `false` — the row becomes invisible
to everyone including its owner. Silent, unrecoverable data loss.

`backend/supabase/migrations/20260803000000_ownership_not_null.sql`

- [x] Orphans are **quarantined, not deleted** — moved to a `public.orphaned_rows`
      audit table as jsonb, then removed from the live table. A row with a null
      owner cannot be reassigned by automation, but that is an argument for a
      human looking at it, not for destroying it inside a migration.
- [x] `set not null` on `fields.user_id`, `crop_instances.field_id`, and
      `crop_instance_id` across `crop_states`, `irrigation_actions`,
      `fertilizer_actions`, `crop_images`.
- [x] Adds the missing `public.users → auth.users` FK on deployed databases,
      quarantining profiles with no matching auth account first so the `alter`
      cannot fail and take the migration with it.

### 1.5 Enable RLS ✅ written

```sql
-- Direct ownership
alter table public.fields enable row level security;
create policy "own fields" on public.fields
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One level down
alter table public.crop_instances enable row level security;
create policy "own crops" on public.crop_instances for all
  using (exists (select 1 from public.fields f
                 where f.id = field_id and f.user_id = auth.uid()))
  with check (exists (select 1 from public.fields f
                      where f.id = field_id and f.user_id = auth.uid()));

-- Two levels down — repeat for crop_states, irrigation_actions,
-- fertilizer_actions, crop_images
alter table public.crop_states enable row level security;
create policy "own crop states" on public.crop_states for all
  using (exists (select 1
                 from public.crop_instances c
                 join public.fields f on f.id = c.field_id
                 where c.id = crop_instance_id and f.user_id = auth.uid()));

-- Self only
alter table public.users enable row level security;
create policy "own profile" on public.users
  for all using (auth.uid() = id) with check (auth.uid() = id);
```

`backend/supabase/migrations/20260803000100_row_level_security.sql`

- [x] **Add indexes** on `fields.user_id`, `crop_instances.field_id`, and every
      `crop_instance_id` column. The `exists` subquery runs per row and is slow
      without them.
- [x] **Keep the existing `.eq("user_id", …)` filters.** RLS is defense in
      depth, not a replacement for them.
- [x] Every policy carries **both `using` and `with check`**. The plan's
      original sketch omitted `with check` on the two-level-down tables; that
      would have permitted the read and silently rejected the write, breaking
      the disease pipeline's upsert into `crop_states` and insert into
      `crop_images`, both of which now run on the request-scoped client.
- [x] Added an explicit `for insert with check (false)` on
      `satellite_observations`. It already had select-only coverage, but "no
      policy" is the absence of a statement, not a statement — say it, so a
      future user-scoped write fails loudly.

### 1.6 Prove it ✅

`backend/src/tests/ownership.test.ts` — 9 subtests.

- [x] Per module: user A creates a resource; user B is denied on read, create,
      update, and delete. Plus a control asserting A can still do all of it,
      so the suite cannot pass by everything being broken.
- [x] One test issuing a raw anon-client query with no JWT across all seven
      tables, asserting zero rows. That single test is the regression guard for
      this entire phase.
- [x] **Refuses to run against a hosted project** unless
      `ALLOW_REMOTE_OWNERSHIP_TESTS=1`. The first run did hit the live project,
      because `.env` points there and `npm test` reads it — cleanup worked, but
      a suite that seeds and deletes auth users should never be one typo in a
      `t.after` away from production. Skips with a stated reason when
      unconfigured; a silently skipped security test reads as a pass.

One thing to fix when the central error handler lands (Phase 2): `deleteField`
does not throw for a non-owner. A DELETE matching zero rows is a successful
DELETE, so the service returns `{ success: true }` and the caller is told a
deletion happened. Nothing is destroyed — the response is just wrong.

### 1.7 Apply the migrations ✅

```bash
cd backend && npx supabase db push --include-all
```

Applied 2026-08-03. All three pending migrations landed:
- `20260101000000_baseline.sql` (no-op, tables existed)
- `20260803000000_ownership_not_null.sql` (NOT NULL constraints)
- `20260803000100_row_level_security.sql` (RLS policies + indexes)

8/8 ownership tests pass: tenant isolation verified end-to-end.

---

## Phase 2 — Hardening ✅ COMPLETE

**Completed 2026-08-05.**

- [x] **Rate limiting** (`express-rate-limit`). Tiered rate limiters in
      `middlewares/rateLimiter.ts`:
      - `/api/auth/*` — 5 per 15 min per IP (brute force)
      - `/api/disease`, `/api/chat` — 20/hour per user id (GPU/LLM spend)
      - everything else — 100/min per IP
- [x] **Helmet** — `app.use(helmet())` in `app.ts`, before routes.
- [x] **Multer limits** — `upload.ts` now has `fileSize: 12MB`, `files: 1`,
      and MIME allowlist in `fileFilter`.
- [x] **Atomic signup** — `auth.service.ts` compensates with
      `admin.deleteUser(user.id)` if profile insert fails.
- [x] **Central error handler** — `utils/errors.ts` with `AppError`,
      `NotFoundError`, `ForbiddenError`, `ValidationError`, etc.
      `middlewares/errorHandler.ts` catches all errors at the end of `app.ts`.
      All controllers refactored to remove try/catch blocks.
- [x] **Stop leaking `err.message` to clients** — unknown errors now log
      detail server-side with a request ID, return generic message to client.
- [x] **Deepen `/api/health`** — now includes database connectivity check.
- [x] **Removed dead imports** — `zustand` from `fertilizer.controller.ts`.

---

## Phase 3 — Deployability ✅ COMPLETE

**Completed 2026-08-05.**

- [x] **`VITE_API_URL`** — `api.ts` now reads from `import.meta.env.VITE_API_URL`
      with localhost fallback. Added `farmsense-frontend/.env.example`.
- [x] **Single-flight token refresh** — module-level `refreshPromise` ensures
      only one refresh request fires; all concurrent waiters share the result.
- [x] **Dockerfiles** — all three created:
      - `backend/Dockerfile` (Node 24 Alpine, native TS)
      - `farmsense-frontend/Dockerfile` (multi-stage: build → nginx)
      - `ai/Dockerfile` (Python 3.11 slim, CPU-only torch)
      - `docker-compose.yml` wiring all three with shared env vars
- [x] **CI** — `.github/workflows/ci.yml` with three jobs:
      - Backend: typecheck + test (lint skipped — typescript-eslint doesn't
        support TS7 yet)
      - Frontend: lint + build
      - AI: ruff lint + pytest
- [ ] **Backend ESLint** — blocked by typescript-eslint not supporting TS7.
      See: https://github.com/typescript-eslint/typescript-eslint/issues/10940
      Using `tsc --noEmit` for type checking in the meantime.

---

## Phase 4 — Tests where they are missing

**Effort: ~2–3 days.**

All 90 existing tests cover pure functions — ETo, water balance, paddy model,
land units, agronomic rules, recommendations. Nothing exercises HTTP, auth, or
the database.

- [ ] **Ownership tests** (Phase 1.6) — highest value, write these first.
- [ ] **Route-level tests** — `supertest` against `app.ts` with a seeded user:
      happy path, 401, and 404 per module.
- [ ] **The confidence gate, end to end.** This is the README's central safety
      claim (`CONFIDENCE_GATE`, `ai/config.py:26`) and nothing verifies it
      survives the AI → backend → UI hop. Assert that a below-gate prediction
      produces a response with **no treatment field at all**, so the
      discriminated union makes the UI branch unreachable rather than merely
      unrendered.
- [ ] **`ai/` has zero test files** despite `pytest` sitting in
      `requirements.txt`. Add coverage for `image_utils` (EXIF rotation, resize
      bounds, corrupt input), `tools.py` (backend error → model-readable text),
      and one grounding test asserting the agent emits no agronomic quantity
      without a corresponding tool result.
- [ ] **Mock the external APIs** — Open-Meteo, NASA POWER, SoilGrids, CDSE.
      Tests must not depend on network access or a free-tier quota.

---

## Phase 5 — Consolidation

**Effort: ~1 day.**

- [ ] **Delete one of the two chat agents.** `ai/chat_service.py` (Anthropic,
      manual tool loop) and `ai/langgraph_agent.py` (OpenAI + LangGraph) both
      define `chat()`. `api.py:18` imports only `langgraph_agent`, so
      `chat_service.py` is currently dead code.

      **Recommendation: keep `chat_service.py`, delete the LangGraph one.** Its
      own docstring makes the case — four tools with no branching workflow and
      no persistent graph state do not justify the framework — and removing it
      drops `langchain`, `langgraph`, and `langchain-openai` from the dependency
      tree. Then add `anthropic` to `requirements.txt` (currently missing) and
      repoint `api.py`.
- [ ] **Model IDs** — `ai/config.py:44` defaults to `gpt-4o`, two generations
      stale. On the Anthropic path `chat_service.py:25` already has
      `claude-sonnet-5`, which is current.
- [ ] **Structured logging** — replace 21 `console.*` calls with `pino`.
      Generate a request id in middleware, forward it as a header to the AI
      service, and have the AI service forward it into its tool calls back to
      the backend. A failed chat currently spans four hops with nothing to
      correlate them.
- [ ] **Remove the 27 `: any`** — mostly `catch (err: any)` and the error
      middleware signature at `app.ts:60`, both of which Phase 2 eliminates
      anyway.

---

## Phase 6 — External data and background jobs

**Effort: ~2 days.**

- [ ] **Cache weather.** `weather.service.ts` and `nasapower.service.ts` have no
      cache, no timeout, and no retry. Add a persistent cache table keyed by
      (lat, lon, date) — NASA POWER data for a past date never changes.
- [ ] **Persist the SoilGrids cache.** `soilgrids.service.ts:49` is an in-memory
      `Map`, discarded on every restart. Soil properties do not change; write
      them to a table.
- [ ] **Timeouts and backoff** on all four external clients. A single slow CDSE
      call currently blocks a request for as long as it takes.
- [ ] **Move the timeline off the request path.** `checkin.service.ts:148` notes
      it recomputes from scratch on every request, pulling external APIs inline.
      Nightly job → materialize into `crop_states` → requests read the stored
      row. This is also what makes the confidence staleness figure meaningful
      rather than always-fresh-by-construction.

---

## Phase 7 — Product gaps for the actual users

**Effort: ~1 week, scope-dependent.**

- [ ] **Hindi i18n.** The agent is instructed to answer in Hindi or Bhojpuri
      but every UI string is English. `react-i18next`,
      extracted strings, `hi` + `en` bundles. For a Gorakhpur-facing app this is
      arguably the largest real-world gap on this list.
      **Explicitly deferred** — functionality first, language after.
- [ ] **Offline / PWA.** Rural connectivity means a dropped connection currently
      loses the observation outright. Service worker + IndexedDB queue for
      check-in answers and photo uploads, replayed on reconnect.
- [ ] **Check-in reminders.** The farmer-as-sensor correction loop only fires if
      someone happens to open the app. Needs SMS (an Indian DLT-registered
      gateway such as MSG91 or Gupshup) or web push. Without it, predict→observe→correct silently degrades to
      predict-only and confidence decays exactly as designed — with no one
      watching.

---

## Suggested order

| Order | Phase | Why here |
|---|---|---|
| 1 | Phase 0 — Commit | Nothing is reviewable until it is committed |
| 2 | Phase 1 — Data access | Everything else builds on correct isolation |
| 3 | Phase 2 — Hardening | Cheap, independent, closes live exposure |
| 4 | Phase 3 — Deployability | Unblocks any deployment at all |
| 5 | Phase 4 — Tests | Locks in 1–3 before the surface grows |
| 6 | Phase 5–6 — Consolidation, data | Quality and cost; no external deadline |
| 7 | Phase 7 — Product | Largest scope; needs real user input |

**If only one thing gets done: Phase 1.** It is the only item where the current
design has no second line of defense.
