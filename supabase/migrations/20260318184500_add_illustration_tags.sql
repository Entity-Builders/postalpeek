-- Add illustration_tags column to store tags generated from the illustration image.
-- These tags represent what the USER actually sees (the artistic postcard),
-- as opposed to visual_tags which describe the original Street View photo.
--
-- Future use cases for original visual_tags:
--   - Re-generate illustration with different style (no need to re-analyze photo)
--   - Reveal "hidden" details (elements in original not shown in illustration)
--   - Variation generation without additional photo analysis costs

ALTER TABLE public.postalpeek_postcards
  ADD COLUMN IF NOT EXISTS illustration_tags jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.postalpeek_postcards.illustration_tags IS
  'Tags extracted from the illustration image (what the user sees). Used for search and matching. Distinct from visual_tags which describe the original Street View photo.';
