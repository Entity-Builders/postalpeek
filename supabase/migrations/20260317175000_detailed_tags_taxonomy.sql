-- Phase 4.2: Prominence Scoring & Metadata Taxonomy
-- Adds structured detailed_tags JSONB and scene-level metadata columns.

ALTER TABLE public.postalpeek_postcards
  ADD COLUMN IF NOT EXISTS detailed_tags jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scene_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS time_of_day text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weather text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS human_activity text DEFAULT NULL;

-- Index on scene-level columns for future filtering
CREATE INDEX IF NOT EXISTS idx_postcards_scene_type ON public.postalpeek_postcards (scene_type);
CREATE INDEX IF NOT EXISTS idx_postcards_time_of_day ON public.postalpeek_postcards (time_of_day);
CREATE INDEX IF NOT EXISTS idx_postcards_weather ON public.postalpeek_postcards (weather);

-- GIN index on detailed_tags for deep JSONB queries
CREATE INDEX IF NOT EXISTS idx_postcards_detailed_tags ON public.postalpeek_postcards USING GIN (detailed_tags);

COMMENT ON COLUMN public.postalpeek_postcards.detailed_tags IS 'Structured AI visual analysis: array of {label, spanish_label, type, weight, confidence, count, position}';
COMMENT ON COLUMN public.postalpeek_postcards.scene_type IS 'Scene classification: residential_street, commercial_district, park, waterfront, etc.';
COMMENT ON COLUMN public.postalpeek_postcards.time_of_day IS 'Apparent time: golden_hour, night, midday, blue_hour, dawn, etc.';
COMMENT ON COLUMN public.postalpeek_postcards.weather IS 'Apparent weather: rainy, sunny, overcast, foggy, etc.';
COMMENT ON COLUMN public.postalpeek_postcards.human_activity IS 'Human presence: people_dining, pedestrians, cyclists, empty_street, etc.';
