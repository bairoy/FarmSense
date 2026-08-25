-- Row level security on the seven remaining tables.
--
-- Until now tenant isolation rested entirely on hand-written
-- `.eq("user_id", ...)` filters in the service layer, with nothing behind
-- them. One forgotten filter in any of eleven modules was a cross-tenant read,
-- and nothing in the database would have objected.
--
-- Ordering matters and is not negotiable:
--   1. the request-scoped Supabase client (so `auth.uid()` resolves at all)
--   2. `20260803000000_ownership_not_null.sql` (so no row is orphaned into
--      invisibility by a NULL predicate)
--   3. this file
--
-- Running this against the old sessionless anon client would return zero rows
-- for every query in the application, which is why the client refactor and
-- these policies belong to the same change.
--
-- The `.eq("user_id", ...)` filters in the services stay. RLS is the second
-- line of defence, not a replacement for the first: keeping both means a
-- dropped policy does not silently open the database, and a missed filter
-- does not silently leak it.

-- =====================================================================
-- INDEXES FIRST
-- =====================================================================
-- Each policy below runs an `exists` subquery per candidate row. Without these
-- that is a sequential scan of `fields` for every row of every crop query -
-- correct, and unusably slow the moment there is real data.

create index if not exists fields_user_id_idx
  on public.fields (user_id);
create index if not exists crop_instances_field_id_idx
  on public.crop_instances (field_id);
create index if not exists crop_states_crop_instance_idx
  on public.crop_states (crop_instance_id);
create index if not exists irrigation_actions_crop_instance_idx
  on public.irrigation_actions (crop_instance_id);
create index if not exists fertilizer_actions_crop_instance_idx
  on public.fertilizer_actions (crop_instance_id);
-- crop_images already has (crop_instance_id, uploaded_at desc) from the
-- digital twin migration, which serves the policy lookup as a prefix.

-- =====================================================================
-- USERS - self only
-- =====================================================================
-- Signup still writes this row through the service-role client, which bypasses
-- RLS. That is correct: at the moment the profile is created the caller has no
-- session to be checked against.

alter table public.users enable row level security;

drop policy if exists "own profile" on public.users;
create policy "own profile" on public.users
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =====================================================================
-- FIELDS - direct ownership
-- =====================================================================

alter table public.fields enable row level security;

drop policy if exists "own fields" on public.fields;
create policy "own fields" on public.fields
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =====================================================================
-- CROP_INSTANCES - one level down
-- =====================================================================
-- `crop_instances` has no user_id of its own; ownership is the field's.

alter table public.crop_instances enable row level security;

drop policy if exists "own crops" on public.crop_instances;
create policy "own crops" on public.crop_instances
  for all
  using (
    exists (
      select 1 from public.fields f
       where f.id = crop_instances.field_id
         and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.fields f
       where f.id = crop_instances.field_id
         and f.user_id = auth.uid()
    )
  );

-- =====================================================================
-- CROP-SCOPED TABLES - two levels down
-- =====================================================================
-- `with check` is not optional on these. The disease pipeline upserts into
-- crop_states and inserts into crop_images through the request-scoped client;
-- a policy with only a `using` clause permits the read and silently rejects
-- the write.

alter table public.crop_states enable row level security;

drop policy if exists "own crop states" on public.crop_states;
create policy "own crop states" on public.crop_states
  for all
  using (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = crop_states.crop_instance_id
         and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = crop_states.crop_instance_id
         and f.user_id = auth.uid()
    )
  );

alter table public.irrigation_actions enable row level security;

drop policy if exists "own irrigation actions" on public.irrigation_actions;
create policy "own irrigation actions" on public.irrigation_actions
  for all
  using (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = irrigation_actions.crop_instance_id
         and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = irrigation_actions.crop_instance_id
         and f.user_id = auth.uid()
    )
  );

alter table public.fertilizer_actions enable row level security;

drop policy if exists "own fertilizer actions" on public.fertilizer_actions;
create policy "own fertilizer actions" on public.fertilizer_actions
  for all
  using (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = fertilizer_actions.crop_instance_id
         and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = fertilizer_actions.crop_instance_id
         and f.user_id = auth.uid()
    )
  );

alter table public.crop_images enable row level security;

drop policy if exists "own crop images" on public.crop_images;
create policy "own crop images" on public.crop_images
  for all
  using (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = crop_images.crop_instance_id
         and f.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = crop_images.crop_instance_id
         and f.user_id = auth.uid()
    )
  );

-- =====================================================================
-- SATELLITE_OBSERVATIONS - close the write gap
-- =====================================================================
-- `20260801000000_digital_twin.sql` granted select only. That was adequate
-- while the fetcher was the sole writer, but "no policy" is not the same
-- statement as "no writes": it is the absence of one. Say it explicitly, so a
-- future user-scoped write fails loudly instead of depending on a table this
-- file never mentions.

drop policy if exists "no user writes to satellite observations"
  on public.satellite_observations;
create policy "no user writes to satellite observations"
  on public.satellite_observations
  for insert
  with check (false);
