-- Fix: When filtering trips, return only ONE postcard per trip (the first by sequence)
-- to avoid showing each stop as a separate card in the feed.
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
  -- When filtering by trips, return only the FIRST postcard per trip (by trip_sequence).
  -- The frontend then loads all trip siblings inside the card's inner carousel.
  IF p_trips_only THEN
    RETURN QUERY
    SELECT DISTINCT ON (trip_id) *
    FROM public.postalpeek_postcards
    WHERE
      trip_id IS NOT NULL
      AND (p_country IS NULL OR country = p_country)
      AND id != ALL(p_exclude_ids)
    ORDER BY trip_id, trip_sequence ASC;
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
    ORDER BY c.sort_index ASC
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE
      (p_country IS NULL OR country = p_country)
      AND id != ALL(p_exclude_ids)
    ORDER BY random()
    LIMIT p_limit;
  END IF;
END;
$$;
