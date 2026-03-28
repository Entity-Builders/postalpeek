-- ============================================================
-- Phase 4.3: Smart Filters with Vibe Metadata
-- ============================================================

DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'postalpeek_smart_album_rules') THEN
    ALTER TABLE public.postalpeek_smart_album_rules 
      DROP CONSTRAINT IF EXISTS postalpeek_smart_album_rules_filter_type_check;

    ALTER TABLE public.postalpeek_smart_album_rules 
      ADD CONSTRAINT postalpeek_smart_album_rules_filter_type_check 
      CHECK (filter_type IN ('country', 'category', 'tag', 'aesthetic_vibe', 'architecture_style', 'color_palette'));

    INSERT INTO public.postalpeek_smart_album_rules (filter_type, filter_value, creative_title) VALUES
      ('color_palette', 'pastel', 'Sueños en Pastel 🌸'),
      ('color_palette', 'neon', 'Noches de Neón 🏮'),
      ('color_palette', 'monochromatic', 'Escenas Monocromáticas 📸'),
      ('color_palette', 'earthy', 'Tonos Terrestres 🍂'),
      ('architecture_style', 'colonial', 'Ruta Colonial 🏛️'),
      ('architecture_style', 'brutalist', 'Joyas Brutalistas 🏢'),
      ('aesthetic_vibe', 'cyberpunk', 'Paraísos Cyberpunk 👾'),
      ('aesthetic_vibe', 'cottagecore', 'Refugios Cottagecore 🌿'),
      ('aesthetic_vibe', 'melancholic', 'Rincones Melancólicos 🌧️')
    ON CONFLICT (filter_type, filter_value) DO NOTHING;
  END IF;
END $$;

-- 3. Redefine the Smart Albums RPC to include the new columns
-- Ensure the return type exists (self-contained: safe to re-run)
DROP TYPE IF EXISTS public.postalpeek_smart_album_list CASCADE;
CREATE TYPE public.postalpeek_smart_album_list AS (
  album_type TEXT,
  filter_value TEXT,
  title TEXT,
  postcard_count INT,
  cover_urls TEXT[]
);

CREATE OR REPLACE FUNCTION public.postalpeek_get_smart_albums(
  p_user_id UUID
) RETURNS SETOF public.postalpeek_smart_album_list AS $$
BEGIN
  RETURN QUERY
  WITH owned_postcards AS (
    SELECT 
      id, 
      country, 
      category, 
      visual_tags, 
      aesthetic_vibes,
      architecture_style,
      color_palette,
      illustration_url
    FROM public.postalpeek_postcards
    WHERE owner_id = p_user_id
  ),
  -- 1. COUNTRY
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
  -- 2. CATEGORY
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
  -- 3. TAGS
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
  -- 4. AESTHETIC VIBES
  unnested_vibes AS (
    SELECT id, illustration_url, unnest(aesthetic_vibes) AS vibe
    FROM owned_postcards
    WHERE aesthetic_vibes IS NOT NULL AND array_length(aesthetic_vibes, 1) > 0
  ),
  vibe_groups AS (
    SELECT 
      'aesthetic_vibe'::text AS album_type,
      vibe::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM unnested_vibes
    GROUP BY vibe
    HAVING COUNT(*) >= 2
  ),
  -- 5. ARCHITECTURE STYLE
  arch_groups AS (
    SELECT 
      'architecture_style'::text AS album_type,
      architecture_style::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM owned_postcards
    WHERE architecture_style IS NOT NULL AND architecture_style != 'none'
    GROUP BY architecture_style
    HAVING COUNT(*) >= 2
  ),
  -- 6. COLOR PALETTE
  color_groups AS (
    SELECT 
      'color_palette'::text AS album_type,
      color_palette::text AS filter_value,
      COUNT(*)::int AS postcard_count,
      array_agg(illustration_url) AS cover_urls
    FROM owned_postcards
    WHERE color_palette IS NOT NULL
    GROUP BY color_palette
    HAVING COUNT(*) >= 2
  ),
  -- COMBINE ALL
  all_groups AS (
    SELECT * FROM country_groups
    UNION ALL
    SELECT * FROM category_groups
    UNION ALL
    SELECT * FROM tag_groups
    UNION ALL
    SELECT * FROM vibe_groups
    UNION ALL
    SELECT * FROM arch_groups
    UNION ALL
    SELECT * FROM color_groups
  )
  -- JOIN WITH RULES DICTIONARY OR FALLBACK
  SELECT 
    g.album_type,
    g.filter_value,
    COALESCE(
      r.creative_title, 
      'Tus postales de ' || initcap(g.filter_value)
    ) AS title,
    g.postcard_count,
    g.cover_urls[1:3] AS cover_urls
  FROM all_groups g
  LEFT JOIN public.postalpeek_smart_album_rules r 
    ON g.album_type = r.filter_type AND lower(g.filter_value) = lower(r.filter_value)
  -- Fallback logic: Tags MUST exist in dict. Everything else gets a pass for now, 
  -- but we prioritize dict if exists.
  WHERE g.album_type != 'tag' OR r.id IS NOT NULL
  ORDER BY g.postcard_count DESC;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
