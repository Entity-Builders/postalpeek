-- Restore the random_feed function that was accidentally dropped in the previous migration
-- due to PostgreSQL function overloading rules (types were identical).

CREATE OR REPLACE FUNCTION public.postalpeek_get_random_feed(
  p_limit INT DEFAULT 10,
  p_country TEXT DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_albums_only BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_count INT;
  v_album_inject_ids UUID[];
  v_remaining_limit INT;
BEGIN
  -- When filtering by albums, return only the FIRST postcard per COMPLETED album.
  IF p_albums_only THEN
    RETURN QUERY
    SELECT DISTINCT ON (p.album_id) p.*
    FROM public.postalpeek_postcards p
    JOIN public.postalpeek_albums a ON a.id = p.album_id
    WHERE
      p.album_id IS NOT NULL
      AND a.status = 'completed'
      AND (p_country IS NULL OR p.country = p_country)
      AND p.id != ALL(p_exclude_ids)
      AND p.illustration_url IS NOT NULL
    ORDER BY p.album_id, p.album_sequence ASC;
    RETURN;
  END IF;

  -- Step 1: Pick up to 2 random UNCLAIMED album-slot postcards
  SELECT ARRAY(
    SELECT s.postcard_id
    FROM postalpeek_album_slots s
    JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE p.owner_id IS NULL
      AND p.illustration_url IS NOT NULL
      AND s.postcard_id != ALL(p_exclude_ids)
      AND (p_country IS NULL OR p.country = p_country)
    ORDER BY random()
    LIMIT 2
  ) INTO v_album_inject_ids;

  -- Return album postcards first
  IF array_length(v_album_inject_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT * FROM postalpeek_postcards WHERE id = ANY(v_album_inject_ids);
  END IF;

  -- Step 2: Fill the rest from normal feed
  v_remaining_limit := p_limit - COALESCE(array_length(v_album_inject_ids, 1), 0);

  SELECT COUNT(*) INTO v_cache_count
  FROM public.postalpeek_feed_cache
  WHERE (p_country IS NULL AND country IS NULL) OR (country = p_country);

  IF v_cache_count > 0 THEN
    RETURN QUERY
    SELECT p.*
    FROM public.postalpeek_feed_cache c
    JOIN public.postalpeek_postcards p ON c.id = p.id
    WHERE
      ((p_country IS NULL AND c.country IS NULL) OR (c.country = p_country))
      AND c.id != ALL(p_exclude_ids)
      AND c.id != ALL(v_album_inject_ids)
      -- Exclude postcards from incomplete albums
      AND (p.album_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_albums a
        WHERE a.id = p.album_id AND a.status = 'completed'
      ))
    ORDER BY c.sort_index ASC
    LIMIT v_remaining_limit;
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE
      (p_country IS NULL OR country = p_country)
      AND illustration_url IS NOT NULL
      AND id != ALL(p_exclude_ids)
      AND id != ALL(v_album_inject_ids)
      AND (album_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_albums a
        WHERE a.id = album_id AND a.status = 'completed'
      ))
    ORDER BY random()
    LIMIT v_remaining_limit;
  END IF;
END;
$$;
