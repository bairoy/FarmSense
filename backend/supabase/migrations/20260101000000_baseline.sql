-- FarmSense: baseline schema
--
-- The seven tables below were originally created through the Supabase
-- dashboard and existed nowhere in this repository. That made every later
-- migration unreproducible: `supabase db reset` on a clean machine produced a
-- database in which `20260801000000_digital_twin.sql` failed on its first
-- `alter table`, because there was no table to alter.
--
-- This file backfills them. Columns and types are reconstructed from
-- `backend/src/types/database.types.ts`, which is generated from the live
-- schema. Foreign keys and defaults are NOT represented in those types and
-- were inferred instead - see the caveat below.
--
-- Every statement is `if not exists`, so applying this to the existing
-- database is a no-op. Its only real effect is on a database built from zero.
--
-- CAVEAT - this is a reconstruction, not a dump.
-- The intended way to produce this file is:
--
--     npx supabase db dump --schema public -f <this file>
--
-- which needs the database password. Until someone runs that and replaces
-- this file wholesale, treat the constraint details here as best-effort. What
-- is known to be right:
--   * `fields.user_id -> auth.users(id) on delete cascade`. Verified
--     behaviourally: deleting an auth user removed that user's fields while
--     leaving their `public.users` row, which only happens with this FK.
--   * `public.users` has NO foreign key to `auth.users` - same evidence, from
--     the other direction. That is a real gap, and
--     `20260803000000_ownership_not_null.sql` closes it on deployed
--     databases; it is declared here so a fresh build already has it.
--
-- Also added deliberately: the unique constraint on
-- `crop_states (crop_instance_id, recorded_date)` that `disease.service.ts`
-- upserts against. It must exist in the deployed database for that upsert to
-- work, but nothing in the repo declared it.

-- =====================================================================
-- USERS
-- =====================================================================
-- The profile row. Supabase owns authentication in `auth.users`; this table
-- holds the application's own view of a person.

create table if not exists public.users (
  -- Not defaulted: the id is always the auth user's id, assigned at signup.
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

-- =====================================================================
-- FIELDS
-- =====================================================================
-- A parcel of land. The root of every ownership chain in the schema: nothing
-- else carries a user_id, so all authorization resolves back to this column.

create table if not exists public.fields (
  id uuid primary key default gen_random_uuid(),
  -- References auth.users, not public.users. `auth.uid()` returns an auth
  -- user id, so pointing the ownership column straight at it means the RLS
  -- predicate compares two things that are the same by construction rather
  -- than by convention.
  user_id uuid references auth.users(id) on delete cascade,
  location_name text not null,
  latitude double precision not null,
  longitude double precision not null,
  soil_type text not null,
  -- Legacy area in acres. Superseded by area_sqm in the digital twin
  -- migration, which backfills from this column and keeps it in sync.
  area double precision,
  created_at timestamptz default now()
);

-- =====================================================================
-- CROP_INSTANCES
-- =====================================================================
-- One crop, one season, one field. The unit everything else hangs off.

create table if not exists public.crop_instances (
  id uuid primary key default gen_random_uuid(),
  field_id uuid references public.fields(id) on delete cascade,
  crop_type text not null,
  -- The anchor date for the entire growth model. Every phase boundary, Kc
  -- value and GDD accumulation is measured from here.
  sowing_date date not null,
  irrigation_method text,
  status text default 'active',
  created_at timestamptz default now()
);

-- =====================================================================
-- CROP_STATES
-- =====================================================================
-- What we believe about the crop on a given day.

create table if not exists public.crop_states (
  id uuid primary key default gen_random_uuid(),
  crop_instance_id uuid references public.crop_instances(id) on delete cascade,
  day_number integer not null,
  phase text not null,
  status text,
  water_stress boolean,
  nutrient_stress boolean,
  disease_risk numeric,
  confidence_score numeric,
  recorded_date date default current_date,
  created_at timestamptz default now()
);

-- One state row per crop per calendar day. `disease.service.ts` upserts
-- against this constraint: a farmer photographing the same crop twice in one
-- day should supersede the earlier diagnosis, not collide with it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crop_states_crop_day_unique'
  ) then
    alter table public.crop_states
      add constraint crop_states_crop_day_unique
      unique (crop_instance_id, recorded_date);
  end if;
end $$;

-- =====================================================================
-- IRRIGATION_ACTIONS
-- =====================================================================
-- What the farmer actually did. These are the only real inputs the water
-- balance has; without them the model is running open-loop.

create table if not exists public.irrigation_actions (
  id uuid primary key default gen_random_uuid(),
  crop_instance_id uuid references public.crop_instances(id) on delete cascade,
  amount numeric not null,
  action_date timestamptz not null default now(),
  created_at timestamptz default now()
);

-- =====================================================================
-- FERTILIZER_ACTIONS
-- =====================================================================

create table if not exists public.fertilizer_actions (
  id uuid primary key default gen_random_uuid(),
  crop_instance_id uuid references public.crop_instances(id) on delete cascade,
  fertilizer_type text not null,
  quantity numeric not null,
  action_date timestamptz not null default now(),
  created_at timestamptz default now()
);

-- =====================================================================
-- CROP_IMAGES
-- =====================================================================
-- Despite the name this is the diagnosis record; see the comment added by
-- `20260802000000_diagnosis_without_image.sql`. `image_url` is NOT NULL here
-- because that is how it was originally created - that migration is what
-- drops the constraint, and the history should show why.

create table if not exists public.crop_images (
  id uuid primary key default gen_random_uuid(),
  crop_instance_id uuid references public.crop_instances(id) on delete cascade,
  image_url text not null,
  confidence numeric,
  health_status text,
  uploaded_at timestamptz default now()
);
