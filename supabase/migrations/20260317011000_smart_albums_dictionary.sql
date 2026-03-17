-- ============================================================
-- postalpeek_smart_album_rules
-- Dictionary table for assigning creative titles to Smart Albums
-- ============================================================

CREATE TABLE IF NOT EXISTS public.postalpeek_smart_album_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filter_type TEXT NOT NULL CHECK (filter_type IN ('country', 'category', 'tag')),
    filter_value TEXT NOT NULL,
    creative_title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(filter_type, filter_value)
);

-- Enable RLS (Read-only for all authenticated users)
ALTER TABLE public.postalpeek_smart_album_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.postalpeek_smart_album_rules
    FOR SELECT USING (true);

-- ============================================================
-- UPDATE: postalpeek_get_smart_albums
-- Now uses a LEFT JOIN against the rules dictionary
-- ============================================================

CREATE OR REPLACE FUNCTION public.postalpeek_get_smart_albums(
  p_user_id UUID
) RETURNS SETOF public.postalpeek_smart_album_list AS $$
BEGIN
  RETURN QUERY
  WITH owned_postcards AS (
    SELECT id, country, category, visual_tags, illustration_url
    FROM public.postalpeek_postcards
    WHERE owner_id = p_user_id
  ),
  -- 1. GROUP BY COUNTRY
  country_groups AS (
    SELECT 
      'country'::text AS album_type,
      country::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM owned_postcards
    WHERE country IS NOT NULL
    GROUP BY country
    HAVING COUNT(*) >= 2
  ),
  -- 2. GROUP BY CATEGORY
  category_groups AS (
    SELECT 
      'category'::text AS album_type,
      category::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM owned_postcards
    WHERE category IS NOT NULL
    GROUP BY category
    HAVING COUNT(*) >= 2
  ),
  -- 3. GROUP BY TAGS
  unnested_tags AS (
    SELECT id, illustration_url, jsonb_array_elements_text(visual_tags) AS tag
    FROM owned_postcards
    WHERE visual_tags IS NOT NULL AND jsonb_typeof(visual_tags) = 'array'
  ),
  tag_groups AS (
    SELECT 
      'tag'::text AS album_type,
      tag::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM unnested_tags
    GROUP BY tag
    HAVING COUNT(*) >= 3
  ),
  -- COMBINE ALL
  all_groups AS (
    SELECT * FROM country_groups
    UNION ALL
    SELECT * FROM category_groups
    UNION ALL
    SELECT * FROM tag_groups
  )
  -- JOIN WITH RULES DICTIONARY OR FALLBACK
  SELECT 
    g.album_type,
    g.filter_value,
    -- The creative title if exists, otherwise "Tus postales de [Value]"
    COALESCE(
      r.creative_title, 
      'Tus postales de ' || initcap(g.filter_value)
    ) AS title,
    g.postcard_count,
    -- Slice top 3 images for the stacked cover look
    g.cover_urls[1:3] AS cover_urls
  FROM all_groups g
  LEFT JOIN public.postalpeek_smart_album_rules r 
    ON g.album_type = r.filter_type AND lower(g.filter_value) = lower(r.filter_value)
  -- Option A: Tags MUST exist in the dictionary, others (country, category) fall back to generic
  WHERE g.album_type != 'tag' OR r.id IS NOT NULL
  ORDER BY g.postcard_count DESC;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
