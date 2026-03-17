-- ============================================================
-- Phase 4.3: Vibe Metadata Migration
-- Updates the postcards table to support aesthetic and atmospheric tags
-- ============================================================

ALTER TABLE public.postalpeek_postcards 
  ADD COLUMN IF NOT EXISTS aesthetic_vibes text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS architecture_style text,
  ADD COLUMN IF NOT EXISTS color_palette text;

-- Add indexes for better performance when filtering/grouping by vibes
CREATE INDEX IF NOT EXISTS idx_postalpeek_postcards_aesthetic_vibes ON public.postalpeek_postcards USING GIN (aesthetic_vibes);
CREATE INDEX IF NOT EXISTS idx_postalpeek_postcards_architecture_style ON public.postalpeek_postcards(architecture_style);
CREATE INDEX IF NOT EXISTS idx_postalpeek_postcards_color_palette ON public.postalpeek_postcards(color_palette);
