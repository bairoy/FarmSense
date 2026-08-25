-- Ownership columns become NOT NULL. Must run BEFORE row level security.
--
-- Every column that an RLS policy will resolve ownership through is currently
-- nullable. Under RLS that is not a cosmetic problem, it is data loss:
--
--     auth.uid() = user_id   -- with user_id NULL
--
-- evaluates to NULL, not false. A policy admits a row only when its predicate
-- is true, so a row with a null ownership column becomes invisible to
-- everyone - including the farmer it belongs to - with no error anywhere. The
-- row is still there; nothing can reach it.
--
-- So the constraints go on first, and any row that cannot satisfy them is
-- dealt with here, in the open, rather than quietly disappearing later.

-- =====================================================================
-- QUARANTINE
-- =====================================================================
-- Orphans are moved, not deleted. A row with a null owner is unrecoverable by
-- automation - there is no way to infer which farmer it belonged to - but that
-- is an argument for a human looking at it, not for destroying it inside a
-- migration. The full row is preserved as jsonb and can be reinstated once
-- somebody decides where it belongs.

create table if not exists public.orphaned_rows (
  id bigserial primary key,
  quarantined_at timestamptz not null default now(),
  source_table text not null,
  reason text not null,
  row_data jsonb not null
);

comment on table public.orphaned_rows is
  'Rows removed by the NOT NULL migration because they had no resolvable owner. Preserved verbatim for manual triage; safe to empty once reviewed.';

do $$
declare
  moved bigint;
begin
  -- ---- fields: the root of every ownership chain --------------------
  with orphans as (
    delete from public.fields where user_id is null returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'fields', 'user_id is null', to_jsonb(orphans) from orphans;

  get diagnostics moved = row_count;
  if moved > 0 then
    raise notice 'quarantined % orphaned fields', moved;
  end if;

  -- ---- crop_instances: null field_id, or a field that just went -----
  -- The FK is `on delete cascade`, so children of a quarantined field are
  -- already gone by this point. The `not exists` arm catches anything that
  -- predates the constraint.
  with orphans as (
    delete from public.crop_instances c
     where c.field_id is null
        or not exists (select 1 from public.fields f where f.id = c.field_id)
    returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'crop_instances', 'field_id is null or unresolvable', to_jsonb(orphans)
  from orphans;

  get diagnostics moved = row_count;
  if moved > 0 then
    raise notice 'quarantined % orphaned crop_instances', moved;
  end if;

  -- ---- the four crop-scoped tables ----------------------------------
  with orphans as (
    delete from public.crop_states t
     where t.crop_instance_id is null
        or not exists (select 1 from public.crop_instances c where c.id = t.crop_instance_id)
    returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'crop_states', 'crop_instance_id is null or unresolvable', to_jsonb(orphans)
  from orphans;

  with orphans as (
    delete from public.irrigation_actions t
     where t.crop_instance_id is null
        or not exists (select 1 from public.crop_instances c where c.id = t.crop_instance_id)
    returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'irrigation_actions', 'crop_instance_id is null or unresolvable', to_jsonb(orphans)
  from orphans;

  with orphans as (
    delete from public.fertilizer_actions t
     where t.crop_instance_id is null
        or not exists (select 1 from public.crop_instances c where c.id = t.crop_instance_id)
    returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'fertilizer_actions', 'crop_instance_id is null or unresolvable', to_jsonb(orphans)
  from orphans;

  with orphans as (
    delete from public.crop_images t
     where t.crop_instance_id is null
        or not exists (select 1 from public.crop_instances c where c.id = t.crop_instance_id)
    returning *
  )
  insert into public.orphaned_rows (source_table, reason, row_data)
  select 'crop_images', 'crop_instance_id is null or unresolvable', to_jsonb(orphans)
  from orphans;
end $$;

-- =====================================================================
-- CONSTRAINTS
-- =====================================================================

alter table public.fields              alter column user_id          set not null;
alter table public.crop_instances      alter column field_id         set not null;
alter table public.crop_states         alter column crop_instance_id set not null;
alter table public.irrigation_actions  alter column crop_instance_id set not null;
alter table public.fertilizer_actions  alter column crop_instance_id set not null;
alter table public.crop_images         alter column crop_instance_id set not null;

-- =====================================================================
-- USERS -> AUTH.USERS
-- =====================================================================
-- Declared in the baseline migration, so a database built from zero already
-- has it. This is the arm that applies it to the deployed database, which was
-- created through the dashboard without it. Both converge on the same schema.
--
-- `auth.uid() = id` is only a meaningful policy if `id` is genuinely the auth
-- user's id rather than a coincidence maintained by application code.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_id_fkey'
  ) then
    -- Profiles with no matching auth account cannot be logged into and cannot
    -- own anything reachable. Quarantine before adding the constraint,
    -- otherwise the alter fails and takes the whole migration with it.
    with orphans as (
      delete from public.users u
       where not exists (select 1 from auth.users a where a.id = u.id)
      returning *
    )
    insert into public.orphaned_rows (source_table, reason, row_data)
    select 'users', 'no matching auth.users row', to_jsonb(orphans) from orphans;

    alter table public.users
      add constraint users_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;
