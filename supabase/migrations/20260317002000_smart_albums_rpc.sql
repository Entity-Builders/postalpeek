-- ==============================================================================
-- POSTALPEEK SMART ALBUMS RPC
-- Generates dynamic album groupings for a specific user based on the postcards they own.
-- Groups by: 1. Country, 2. Category, 3. Visual Tags
-- ==============================================================================

-- 1. Create a custom return type for the smart albums
DROP TYPE IF EXISTS public.postalpeek_smart_album_list CASCADE;

CREATE TYPE public.postalpeek_smart_album_list AS (
  album_type TEXT,        -- 'country', 'category', or 'tag'
  filter_value TEXT,      -- e.g., 'Japan', 'Architecture', 'cat'
  title TEXT,             -- Formatted title for UI e.g., 'Tus postales de Japan'
  postcard_count INT,     -- How many owned postcards match this filter
  cover_urls TEXT[]       -- Up to 3 illustration_urls for the stacking effect in the UI
);

-- 2. Create the RPC function
DROP FUNCTION IF EXISTS public.postalpeek_get_smart_albums(UUID);

CREATE OR REPLACE FUNCTION public.postalpeek_get_smart_albums(p_user_id UUID)
RETURNS SETOF public.postalpeek_smart_album_list
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We union three different groupings together.

  RETURN QUERY
  
  -- GROUPING 1: BY COUNTRY
  SELECT 
    'country'::TEXT AS album_type,
    country::TEXT AS filter_value,
    'Tus postales de ' || country AS title,
    COUNT(*)::INT AS postcard_count,
    ARRAY(
      SELECT illustration_url 
      FROM public.postalpeek_postcards 
      WHERE owner_id = p_user_id AND country = sub.country AND illustration_url IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 3
    ) AS cover_urls
  FROM public.postalpeek_postcards sub
  WHERE owner_id = p_user_id AND country IS NOT NULL
  GROUP BY country
  HAVING COUNT(*) >= 2 -- Minimum 2 postcards to count as an album

  UNION ALL

  -- GROUPING 2: BY CATEGORY
  SELECT 
    'category'::TEXT AS album_type,
    category::TEXT AS filter_value,
    'Tus lugares de ' || category AS title,
    COUNT(*)::INT AS postcard_count,
    ARRAY(
      SELECT illustration_url 
      FROM public.postalpeek_postcards 
      WHERE owner_id = p_user_id AND category = sub.category AND illustration_url IS NOT NULL
      ORDER BY created_at DESC 
      LIMIT 3
    ) AS cover_urls
  FROM public.postalpeek_postcards sub
  WHERE owner_id = p_user_id AND category IS NOT NULL
  GROUP BY category
  HAVING COUNT(*) >= 2

  UNION ALL

  -- GROUPING 3: BY VISUAL TAGS
  -- We need to unnest the JSONB array to group by individual tags
  SELECT 
    'tag'::TEXT AS album_type,
    vt.tag::TEXT AS filter_value,
    'Tus vistas con ' || vt.tag AS title,
    COUNT(*)::INT AS postcard_count,
    ARRAY(
      SELECT p_inner.illustration_url 
      FROM public.postalpeek_postcards p_inner
      WHERE p_inner.owner_id = p_user_id 
        AND p_inner.visual_tags ? vt.tag
        AND p_inner.illustration_url IS NOT NULL
      ORDER BY p_inner.created_at DESC 
      LIMIT 3
    ) AS cover_urls
  FROM public.postalpeek_postcards p
  CROSS JOIN LATERAL jsonb_array_elements_text(p.visual_tags) AS vt(tag)
  WHERE p.owner_id = p_user_id
  GROUP BY vt.tag
  HAVING COUNT(*) >= 2
  
  -- Final sort by size (biggest collections first)
  ORDER BY postcard_count DESC;

END;
$$;
