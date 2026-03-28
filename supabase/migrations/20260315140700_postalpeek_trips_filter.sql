-- RPC: Pick the active trip with fewest postcards (for trip continuation priority)
CREATE OR REPLACE FUNCTION public.postalpeek_get_least_progressed_trip()
RETURNS SETOF public.postalpeek_trips
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT t.*
  FROM postalpeek_trips t
  LEFT JOIN postalpeek_postcards p ON p.trip_id = t.id
  WHERE t.status = 'active'
  GROUP BY t.id
  ORDER BY COUNT(p.id) ASC, t.created_at ASC
  LIMIT 1;
$$;

-- Fix: When filtering trips, bypass the cache and query directly
-- (trips are rare in the random cache, so direct query ensures results)
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
  -- When filtering by trips, always query directly (trips are sparse in cache)
  IF p_trips_only THEN
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE
      (p_country IS NULL OR country = p_country)
      AND id != ALL(p_exclude_ids)
      AND trip_id IS NOT NULL
    ORDER BY created_at DESC
    LIMIT p_limit;
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
