-- FarmSense: digital twin core schema
--
-- Run with: supabase db push   (or paste into the Supabase SQL editor)
--
-- Everything here is additive and idempotent. No existing column is dropped,
-- so this can be applied to a live database without data loss. The legacy
-- `fields.area` (acres) and `crop_images.image_url` columns are kept and
-- backfilled rather than removed.

-- =====================================================================
-- FIELDS: boundary geometry + canonical area
-- =====================================================================
-- A single lat/long point is not enough to average satellite pixels over. A
-- 10m Sentinel-2 pixel centred on a dropped pin can easily sit on a bund, a
-- farm track, or the neighbour's plot.
--
-- The boundary is stored as GeoJSON in jsonb rather than PostGIS geometry:
-- the only operations we need (area, centroid) are done in application code,
-- and this avoids requiring the PostGIS extension.

alter table public.fields
  add column if not exists boundary jsonb,
  -- Canonical area. Everything downstream (fertilizer kg, irrigation litres)
  -- is computed from this one number, in one unit.
  add column if not exists area_sqm numeric,
  -- How area_sqm was obtained: 'boundary' | 'area_sqm' | 'nepali_units'.
  -- A traced boundary is a measurement; a typed number is a recollection.
  add column if not exists area_source text;

-- Backfill from the legacy acres column so existing fields keep working.
update public.fields
   set area_sqm = area * 4046.8564224,
       area_source = 'legacy_acres'
 where area_sqm is null
   and area is not null;

comment on column public.fields.boundary is
  'GeoJSON Polygon, single exterior ring, [lon, lat] order.';
comment on column public.fields.area_sqm is
  'Canonical field area in square metres. Display units (bigha/kattha/dhur, hectares) are derived in application code.';

-- =====================================================================
-- CROP_STATES: provenance and confidence
-- =====================================================================
-- Previously a crop_state was just a number with no indication of where it
-- came from. A satellite-corrected state and a farmer's guess are not the
-- same kind of thing and must not be averaged together blindly.

alter table public.crop_states
  add column if not exists source text default 'rule_engine',
  add column if not exists confidence numeric,
  add column if not exists health_score numeric,
  add column if not exists stale_days integer,
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crop_states_source_check'
  ) then
    alter table public.crop_states
      add constraint crop_states_source_check
      check (source in (
        'rule_engine',
        'satellite_corrected',
        'farmer_reported',
        'disease_model'
      ));
  end if;
end $$;

comment on column public.crop_states.source is
  'Which system produced this state. Never averaged across sources without weighting by confidence.';

-- =====================================================================
-- CROP_IMAGES: store keys, not bytes
-- =====================================================================
-- Postgres stores the R2 object key and the analysis result - a few hundred
-- bytes per row. The image itself lives in Cloudflare R2, which charges zero
-- egress. A photo-heavy crop history re-displays the same images on every
-- visit, so egress (not storage) is the quota that actually bites.

alter table public.crop_images
  add column if not exists r2_key text,
  add column if not exists disease_class text,
  add column if not exists treatment_recommended text,
  add column if not exists crop_state_id uuid references public.crop_states(id) on delete set null,
  add column if not exists original_bytes integer,
  add column if not exists stored_bytes integer;

comment on column public.crop_images.r2_key is
  'Cloudflare R2 object key. Never store image bytes in Postgres.';
comment on column public.crop_images.treatment_recommended is
  'NULL when the classifier confidence was below the gate. A null here means "we deliberately did not advise", not "no data".';
comment on column public.crop_images.crop_state_id is
  'Links a diagnosis to the crop_states row it created, so disease detection joins the health timeline instead of being a disconnected feature.';

create index if not exists crop_images_crop_instance_idx
  on public.crop_images (crop_instance_id, uploaded_at desc);

-- =====================================================================
-- SATELLITE_OBSERVATIONS: raw correction inputs
-- =====================================================================
-- Deliberately separate from crop_states. This table holds what the SENSOR
-- MEASURED; crop_states holds what we CONCLUDED. Keeping them apart means the
-- fusion logic can change and every past state can be recomputed from the
-- original observations without re-querying Copernicus.

create table if not exists public.satellite_observations (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields(id) on delete cascade,
  observed_date date not null,
  source text not null check (source in ('sentinel1', 'sentinel2')),

  -- Sentinel-2 optical (wheat season)
  ndvi numeric,
  ndwi numeric,
  cloud_cover_pct integer,

  -- Sentinel-1 SAR (rice season - sees through monsoon cloud)
  backscatter_vh_db numeric,
  backscatter_vv_db numeric,
  likely_flooded boolean,

  -- False when too many pixels were masked out to trust the field average.
  -- We record failed attempts too: the fusion step needs to know we tried and
  -- could not see, so it widens uncertainty instead of assuming no news is
  -- good news.
  usable boolean not null default true,

  created_at timestamptz default now(),

  -- One observation per field per date per sensor. Re-running a fetch updates
  -- rather than duplicating.
  unique (field_id, observed_date, source)
);

create index if not exists satellite_observations_field_date_idx
  on public.satellite_observations (field_id, observed_date desc);

-- =====================================================================
-- FARMER_CHECKINS: the human sensor
-- =====================================================================
-- No hardware needed. A farmer answering one yes/no question a week is a real
-- in-situ observation, and more current than any satellite pass.

create table if not exists public.farmer_checkins (
  id uuid primary key default gen_random_uuid(),
  crop_instance_id uuid not null references public.crop_instances(id) on delete cascade,

  question_key text not null,
  question_text text not null,
  asked_at timestamptz not null default now(),

  answer text,
  responded_at timestamptz,

  -- What the model should do with this answer, computed at response time and
  -- stored so the mapping is auditable after the fact.
  model_correction jsonb,

  created_at timestamptz default now()
);

create index if not exists farmer_checkins_crop_idx
  on public.farmer_checkins (crop_instance_id, asked_at desc);

create index if not exists farmer_checkins_pending_idx
  on public.farmer_checkins (crop_instance_id)
  where responded_at is null;

-- =====================================================================
-- IRRIGATION: make the amount meaningful
-- =====================================================================
-- The engine assumed a flat 25mm per irrigation event. A farmer who ran a
-- pump for four hours did not apply the same water as one who ran it for one,
-- and the water balance is only as good as this input.

comment on column public.irrigation_actions.amount is
  'Applied water depth in mm. When null the engine falls back to a 25mm assumption, which materially degrades the water balance.';

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
-- Ownership is enforced in application code, by joining through
-- fields.user_id. RLS here is defence in depth: a leaked anon key cannot read
-- another farmer's check-ins or satellite observations directly.
--
-- IMPORTANT: because these policies resolve auth.uid(), the anon client cannot
-- satisfy them (the backend attaches no user JWT to it). Any module touching
-- these two tables must therefore use `supabaseAdmin`, the service-role
-- client, which bypasses RLS. See checkin.service.ts and satellite.service.ts.
-- The pre-existing tables have no RLS at all, so they work on either client -
-- these two are strictly more protected, not less.

alter table public.satellite_observations enable row level security;
alter table public.farmer_checkins enable row level security;

drop policy if exists "own satellite observations" on public.satellite_observations;
create policy "own satellite observations"
  on public.satellite_observations for select
  using (
    exists (
      select 1 from public.fields f
      where f.id = satellite_observations.field_id
        and f.user_id = auth.uid()
    )
  );

drop policy if exists "own checkins" on public.farmer_checkins;
create policy "own checkins"
  on public.farmer_checkins for all
  using (
    exists (
      select 1
        from public.crop_instances c
        join public.fields f on f.id = c.field_id
       where c.id = farmer_checkins.crop_instance_id
         and f.user_id = auth.uid()
    )
  );
