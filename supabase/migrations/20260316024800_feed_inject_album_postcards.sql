-- Modify postalpeek_get_random_feed to inject 1-2 album postcards per batch.
-- This ensures users always see collectible postcards in their feed.

CREATE OR REPLACE FUNCTION public.postalpeek_get_random_feed(
  p_limit INT DEFAULT 10,
  p_country TEXT DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_trips_only BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_count INT;
  v_album_ids UUID[];
  v_remaining_limit INT;
BEGIN
  -- When filtering by trips, return only the FIRST postcard per COMPLETED trip.
  IF p_trips_only THEN
    RETURN QUERY
    SELECT DISTINCT ON (p.trip_id) p.*
    FROM public.postalpeek_postcards p
    JOIN public.postalpeek_trips t ON t.id = p.trip_id
    WHERE
      p.trip_id IS NOT NULL
      AND t.status = 'completed'
      AND (p_country IS NULL OR p.country = p_country)
      AND p.id != ALL(p_exclude_ids)
      AND p.illustration_url IS NOT NULL
    ORDER BY p.trip_id, p.trip_sequence ASC;
    RETURN;
  END IF;

  -- Step 1: Pick up to 2 random UNCLAIMED album postcards not yet excluded
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
  ) INTO v_album_ids;

  -- Return album postcards first
  IF array_length(v_album_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT * FROM postalpeek_postcards WHERE id = ANY(v_album_ids);
  END IF;

  -- Step 2: Fill the rest from normal feed (excluding album ones already returned)
  v_remaining_limit := p_limit - COALESCE(array_length(v_album_ids, 1), 0);

  -- Normal path: Check cache first
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
      AND c.id != ALL(v_album_ids)
      -- Exclude postcards from incomplete trips
      AND (p.trip_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_trips t
        WHERE t.id = p.trip_id AND t.status = 'completed'
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
      AND id != ALL(v_album_ids)
      -- Exclude postcards from incomplete trips
      AND (trip_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_trips t
        WHERE t.id = trip_id AND t.status = 'completed'
      ))
    ORDER BY random()
    LIMIT v_remaining_limit;
  END IF;
END;
$$;
