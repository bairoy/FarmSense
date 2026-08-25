-- Land units become region-driven rather than Nepal-specific.
--
-- `area_source` recorded 'nepali_units' for any area a farmer typed in
-- Bigha-Kattha-Dhur. The unit ladder now comes from the active region config
-- (see backend/src/modules/rules/regions/*.json), so the marker is renamed to
-- the region-neutral 'local_units'. The column is free text with no check
-- constraint, so this is a data rename only.
--
-- NOTE ON EXISTING ROWS: `area_sqm` is canonical and is NOT rewritten here.
-- It is still the area the farmer meant when they entered it. But a row
-- entered under the Nepal Terai bigha (6772 m2) will now be DISPLAYED in the
-- UP pucca bigha (2529.29 m2), so the same field reads as roughly 2.7x more
-- bigha than before. That is correct behaviour for a region change, and it is
-- also why any pre-existing field should have its area confirmed with the
-- farmer rather than trusted.

update public.fields
   set area_source = 'local_units'
 where area_source = 'nepali_units';

comment on column public.fields.area_source is
  'How area_sqm was obtained: ''boundary'' | ''area_sqm'' | ''local_units''.';
