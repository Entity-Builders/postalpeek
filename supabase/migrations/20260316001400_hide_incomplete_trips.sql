-- Hide trips from the feed unless all their stops are completed.
-- This updates postalpeek_get_random_feed to:
--   1. (trips-only mode) JOIN postalpeek_trips and only return completed trips.
--   2. (normal feed)    Exclude postcards belonging to incomplete trips.

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
      -- Exclude postcards from incomplete trips
      AND (p.trip_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_trips t
        WHERE t.id = p.trip_id AND t.status = 'completed'
      ))
    ORDER BY c.sort_index ASC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE
      (p_country IS NULL OR country = p_country)
      AND illustration_url IS NOT NULL
      AND id != ALL(p_exclude_ids)
      -- Exclude postcards from incomplete trips
      AND (trip_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_trips t
        WHERE t.id = trip_id AND t.status = 'completed'
      ))
    ORDER BY random()
    LIMIT p_limit;
  END IF;
END;
$$;
