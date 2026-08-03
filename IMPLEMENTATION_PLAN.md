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

## Phase 0 — Commit what exists

**Effort: ~30 min. Do this before reading further.**

- [ ] 46 modified + 25 untracked files are unversioned, including entire modules
      (`chat/`, `checkin/`, `satellite/`, `recommendations/`, `images/`,
      `tests/`).
- [ ] Split into reviewable commits:
      1. rules engine + the 6 test files
      2. satellite + checkin modules
      3. chat + recommendations modules
      4. frontend changes
- [ ] Confirm the deletion of `backend/src/modules/rules/agronomic.rules.json`
      is intentional — `rules.loader.ts` still exists; verify it now reads
      `regions/siraha.json` and `fertilizer.rates.json` instead.

Nothing below is reviewable, revertible, or safe to build on until this is done.

---

## Phase 1 — Data access foundation

**Effort: ~2–3 days. Single atomic change — splitting it leaves the app broken
in between.**

### 1.1 Request-scoped Supabase client

Add to `backend/src/config/supabase.ts`:

```ts
export const userClient = (accessToken: string) =>
  createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
```

- [ ] In `auth.middleware.ts`, after `getUser(token)` succeeds, attach
      `req.db = userClient(token)`.
- [ ] Add `db: SupabaseClient<Database>` to `backend/src/types/express.d.ts`.

`auth.uid()` now resolves inside Postgres. Only then can a policy enforce
anything.

### 1.2 Thread the client through the services

- [ ] Change each service signature from `(userId, …)` to `(db, userId, …)`;
      controllers pass `req.db`.
- [ ] Files: `fields`, `crops`, `irrigation`, `fertilizer`, `crop-state`,
      `disease`, `recommendations/cropState.fusion`.
- [ ] **Keep `supabaseAdmin` deliberately** in `timeline.engine.ts`,
      `checkin.service.ts`, `satellite.service.ts`, `satellite.controller.ts`.
      These write system-computed rows and legitimately bypass RLS. Retain their
      explicit `.eq("user_id", …)` filters and add a comment at each admin usage
      stating why it is admin.

Mechanical and safe — `npm run typecheck` catches every missed call site.

### 1.3 Backfill the schema into migrations

- [ ] Dump the seven dashboard-created tables:
      ```bash
      npx supabase db dump --schema public \
        -f backend/supabase/migrations/20260101000000_baseline.sql
      ```
- [ ] Reorder so the baseline timestamp precedes
      `20260801000000_digital_twin.sql`.
- [ ] Verify `npx supabase db reset` rebuilds the database from zero.

Without this, none of the RLS work below is reproducible on a fresh environment.

### 1.4 NOT NULL constraints — must precede RLS

Every ownership column in the table above is **nullable**. Under RLS,
`auth.uid() = NULL` evaluates to `NULL`, not `false` — the row becomes invisible
to everyone including its owner. Silent, unrecoverable data loss.

- [ ] New migration: identify orphans, backfill or delete them.
- [ ] `alter table … alter column … set not null` on `fields.user_id`,
      `crop_instances.field_id`, and `crop_instance_id` across `crop_states`,
      `irrigation_actions`, `fertilizer_actions`, `crop_images`.

### 1.5 Enable RLS

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

- [ ] **Add indexes** on `fields.user_id`, `crop_instances.field_id`, and every
      `crop_instance_id` column. The `exists` subquery runs per row and is slow
      without them.
- [ ] **Keep the existing `.eq("user_id", …)` filters.** RLS is defense in
      depth, not a replacement for them.

### 1.6 Prove it

- [ ] Per module: user A creates a resource; user B receives 404/empty on read,
      update, and delete.
- [ ] One test issuing a raw anon-client query with no JWT, asserting zero rows.
      That single test is the regression guard for this entire phase.

---

## Phase 2 — Hardening

**Effort: ~1 day. Independent of Phase 1 — can run in parallel.**

- [ ] **Rate limiting** (`express-rate-limit`). Tiered, not one global bucket:
      - `/api/auth/*` — 5 per 15 min per IP (brute force)
      - `/api/disease`, `/api/chat` — ~20/hour **per user id** (real GPU and LLM
        spend; an IP bucket is the wrong key here)
      - everything else — 100/min
- [ ] **Helmet** — `app.use(helmet())` in `app.ts`, before routes.
- [ ] **Multer limits** — `backend/src/middlewares/upload.ts:3` passes no
      `limits`. A 500MB body is fully buffered into memory before the size check
      at `disease.controller.ts:15` ever runs:
      ```ts
      multer({ storage, limits: { fileSize: 12 * 1024 * 1024, files: 1 } })
      ```
      Move the MIME allowlist into `fileFilter` while here.
- [ ] **Atomic signup** — `auth.service.ts:5-24` creates the auth user, then
      inserts the `users` row. A failed insert leaves an orphaned account that
      can log in with no profile. Either compensate with
      `admin.deleteUser(user.id)` on failure, or (better) move profile creation
      into a Postgres trigger on `auth.users` so it is genuinely atomic.
- [ ] **Central error handler** — add `utils/errors.ts` with `AppError` and
      `NotFoundError` / `ForbiddenError` / `ValidationError`. One `errorHandler`
      at the end of `app.ts`. This deletes ~15 duplicated try/catch blocks and
      removes the `err.message?.includes("not found")` string matching at
      `disease.controller.ts:31`.
- [ ] **Stop leaking `err.message` to clients** (e.g. `crop.controller.ts:17`).
      Log the detail server-side; return a generic message plus a request id.
- [ ] **Deepen `/api/health`** (`app.ts:36`) — it reports integration config but
      never touches the database. Add a `select 1` round-trip.

---

## Phase 3 — Deployability

**Effort: ~1–2 days.**

- [ ] **`VITE_API_URL`** — `services/api.ts:5` and `:42` hardcode
      `http://localhost:5050`. Add `farmsense-frontend/.env.example`. The
      frontend cannot be deployed anywhere until this changes.
- [ ] **Single-flight token refresh** — `api.ts:28-64` fires one `/auth/refresh`
      per concurrent 401. With refresh-token rotation, the later responses
      invalidate the winner and the user is logged out mid-session. Hold one
      module-level promise; all waiters await it.
- [ ] **Dockerfiles** — three:
      - `backend/Dockerfile` (Node 24, native TS)
      - `farmsense-frontend/Dockerfile` (vite build → nginx)
      - `ai/Dockerfile` (**use the CPU-only torch wheel** — the default CUDA
        wheel produces a ~6GB image)
      - `docker-compose.yml` wiring all three with a shared `AI_SERVICE_TOKEN`
- [ ] **CI** — one GitHub Actions workflow: backend `typecheck` + `test`,
      frontend `build` + `lint`, `pytest`. A green 90-test suite with nothing
      enforcing it stays green is a suite that will not stay green.
- [ ] **Backend ESLint** — no config exists. Copy the frontend's.

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

- [ ] **Nepali i18n.** The agent is instructed to answer in Nepali
      (`chat_service.py:57`) but every UI string is English. `react-i18next`,
      extracted strings, `ne` + `en` bundles. For a Siraha-facing app this is
      arguably the largest real-world gap on this list.
- [ ] **Offline / PWA.** Rural connectivity means a dropped connection currently
      loses the observation outright. Service worker + IndexedDB queue for
      check-in answers and photo uploads, replayed on reconnect.
- [ ] **Check-in reminders.** The farmer-as-sensor correction loop only fires if
      someone happens to open the app. Needs SMS (Sparrow SMS operates in Nepal)
      or web push. Without it, predict→observe→correct silently degrades to
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
