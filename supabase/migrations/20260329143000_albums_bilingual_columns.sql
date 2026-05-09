-- Add bilingual title/description columns to postalpeek_albums
-- Keeps original title/description as fallback, adds _es/_en variants

ALTER TABLE postalpeek_albums ADD COLUMN IF NOT EXISTS title_es TEXT;
ALTER TABLE postalpeek_albums ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE postalpeek_albums ADD COLUMN IF NOT EXISTS description_es TEXT;
ALTER TABLE postalpeek_albums ADD COLUMN IF NOT EXISTS description_en TEXT;

-- Backfill: copy existing title/description into _en (they were generated in English)
UPDATE postalpeek_albums SET title_en = title, description_en = description
WHERE title_en IS NULL;
