-- PostalPeek: Convert text fields to bilingual JSONB { es, en }
-- Existing Spanish text is wrapped into {"es": "..."} automatically.

-- Step 1: Convert category TEXT → JSONB with data backfill
ALTER TABLE public.postalpeek_postcards
  ALTER COLUMN category TYPE JSONB
  USING CASE
    WHEN category IS NOT NULL THEN jsonb_build_object('es', category)
    ELSE NULL
  END;

-- Step 2: Convert description TEXT → JSONB with data backfill
ALTER TABLE public.postalpeek_postcards
  ALTER COLUMN description TYPE JSONB
  USING CASE
    WHEN description IS NOT NULL THEN jsonb_build_object('es', description)
    ELSE NULL
  END;

-- Step 3: Add storytelling_en column for bilingual did_you_know/narrative_link
ALTER TABLE public.postalpeek_postcards
  ADD COLUMN IF NOT EXISTS storytelling_en JSONB;
