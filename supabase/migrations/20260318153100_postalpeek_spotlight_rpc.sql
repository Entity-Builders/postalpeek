CREATE OR REPLACE FUNCTION public.postalpeek_spotlight_search(
  p_tags text[] DEFAULT '{}',
  p_time_of_day text DEFAULT NULL,
  p_weather text DEFAULT NULL,
  p_scene_type text DEFAULT NULL,
  p_country text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_rarity text DEFAULT NULL,
  p_free_text text DEFAULT NULL,
  p_limit INT DEFAULT 4
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.*
  FROM public.postalpeek_postcards p
  WHERE
    p.illustration_url IS NOT NULL
    AND p.owner_id IS NULL
    AND (p.album_id IS NULL OR EXISTS (
      SELECT 1 FROM public.postalpeek_albums a
      WHERE a.id = p.album_id AND a.status = 'completed'
    ))
    AND (array_length(p_tags, 1) IS NULL OR (
      p.visual_tags && p_tags
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(case jsonb_typeof(p.detailed_tags) when 'array' then p.detailed_tags else '[]'::jsonb end) AS dt
        WHERE dt->'label'->>'en' = ANY(p_tags)
           OR dt->'label'->>'es' = ANY(p_tags)
           OR dt->'label'->>'es_ar' = ANY(p_tags)
      )
    ))
    AND (p_time_of_day IS NULL OR p.time_of_day ILIKE '%' || p_time_of_day || '%')
    AND (p_weather IS NULL OR p.weather ILIKE '%' || p_weather || '%')
    AND (p_scene_type IS NULL OR p.scene_type ILIKE '%' || p_scene_type || '%')
    AND (p_country IS NULL OR p.country ILIKE '%' || p_country || '%')
    AND (p_city IS NULL OR p.city ILIKE '%' || p_city || '%')
    AND (p_rarity IS NULL OR p.rarity ILIKE '%' || p_rarity || '%')
    AND (p_free_text IS NULL OR (
      p.title ILIKE '%' || p_free_text || '%' OR
      p.description ILIKE '%' || p_free_text || '%' OR
      p.city ILIKE '%' || p_free_text || '%' OR
      p.country ILIKE '%' || p_free_text || '%' OR
      p.time_of_day ILIKE '%' || p_free_text || '%' OR
      p.scene_type ILIKE '%' || p_free_text || '%'
    ))
  ORDER BY random()
  LIMIT p_limit;
END;
$$;
