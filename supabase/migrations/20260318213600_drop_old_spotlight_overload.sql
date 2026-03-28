-- Drop the old overloaded version that lacks p_require_illustration_tags.
-- PostgREST (PGRST203) cannot disambiguate between the two signatures.
-- We keep only the newer 10-parameter version.
DROP FUNCTION IF EXISTS public.postalpeek_spotlight_search(
  p_tags               text[],
  p_time_of_day        text,
  p_weather            text,
  p_scene_type         text,
  p_country            text,
  p_city               text,
  p_rarity             text,
  p_free_text          text,
  p_limit              integer
);
