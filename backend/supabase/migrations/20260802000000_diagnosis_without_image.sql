-- crop_images: allow a diagnosis record with no stored image.
--
-- `crop_images` is misleadingly named: it is the DIAGNOSIS record. It carries
-- disease_class, confidence, treatment_recommended and the link to the
-- crop_states row - the image itself is only an attachment, and lives in R2.
--
-- Commissioning exposed the consequence of the NOT NULL on image_url: with R2
-- unconfigured the upload is skipped, so the row was skipped too, so the
-- photo history stayed empty AND the fused crop state could never find the
-- most recent diagnosis (it reads from this table), which silently disabled
-- the health-score cap that a confirmed disease is supposed to apply.
--
-- Losing the photo is acceptable. Losing the observation is not.

alter table public.crop_images
  alter column image_url drop not null;

comment on column public.crop_images.image_url is
  'Resolved URL at time of write. NULL when no image was stored (e.g. R2 unconfigured) - the diagnosis in this row is still valid.';

comment on table public.crop_images is
  'Diagnosis records from crop photo analysis. The image is an attachment stored in R2 (r2_key); the diagnosis columns are the point of the table.';
