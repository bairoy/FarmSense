-- Idempotency keys for the mutation endpoints the mobile app can queue
-- offline (irrigation, fertilizer, disease photo uploads).
--
-- The mobile client generates one UUID per queued write and retries with the
-- same key until it gets a response. Without a server-side dedupe key, a
-- retry after a dropped response (request succeeded, reply never arrived)
-- creates a second row. The service layer does insert-or-return-existing on
-- conflict; this migration only adds the column and the constraint it reads.
--
-- Check-in answers are NOT included: `POST /checkins/:id/answer` updates an
-- existing row by its server-assigned id rather than inserting one, so
-- retrying it is already naturally idempotent - the same update applied
-- twice leaves the same end state, no dedupe key needed.

alter table public.irrigation_actions
  add column if not exists client_request_id text;

alter table public.fertilizer_actions
  add column if not exists client_request_id text;

alter table public.crop_images
  add column if not exists client_request_id text;

-- Scoped per crop instance, not globally unique: a client-generated UUID
-- collision is already astronomically unlikely, but scoping keeps the index
-- small and matches how every other ownership check in this codebase scopes
-- through crop_instance_id.
create unique index if not exists irrigation_actions_client_request_id_idx
  on public.irrigation_actions (crop_instance_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists fertilizer_actions_client_request_id_idx
  on public.fertilizer_actions (crop_instance_id, client_request_id)
  where client_request_id is not null;

create unique index if not exists crop_images_client_request_id_idx
  on public.crop_images (crop_instance_id, client_request_id)
  where client_request_id is not null;
