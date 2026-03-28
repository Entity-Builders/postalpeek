-- Fix double-wrapped bilingual JSON objects in postalpeek_postcards
-- Caused by migrating existing JSON strings with a wrapper, or Gemini returning nested object shapes.
-- e.g. {"es": {"es": "..."}} -> {"es": "..."}

-- Fix double-wrapped description (Spanish)
UPDATE public.postalpeek_postcards
SET description = jsonb_set(description, '{es}', description->'es'->'es')
WHERE jsonb_typeof(description->'es') = 'object' 
  AND description->'es'->>'es' IS NOT NULL;

-- Fix double-wrapped description (English)
UPDATE public.postalpeek_postcards
SET description = jsonb_set(description, '{en}', description->'es'->'en')
WHERE jsonb_typeof(description->'es') = 'object' 
  AND description->'es'->>'en' IS NOT NULL;

-- Fix double-wrapped category (Spanish)
UPDATE public.postalpeek_postcards
SET category = jsonb_set(category, '{es}', category->'es'->'es')
WHERE jsonb_typeof(category->'es') = 'object' 
  AND category->'es'->>'es' IS NOT NULL;

-- Fix double-wrapped category (English)
UPDATE public.postalpeek_postcards
SET category = jsonb_set(category, '{en}', category->'es'->'en')
WHERE jsonb_typeof(category->'es') = 'object' 
  AND category->'es'->>'en' IS NOT NULL;
