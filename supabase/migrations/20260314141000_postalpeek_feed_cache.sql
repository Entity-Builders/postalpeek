-- 1. Create the materialized cache table
CREATE TABLE IF NOT EXISTS public.postalpeek_feed_cache (
  id UUID REFERENCES public.postalpeek_postcards(id) ON DELETE CASCADE,
  country TEXT, -- NULL means 'Everywhere'
  sort_index INT NOT NULL
);

-- Index for fast querying by country and index
CREATE INDEX IF NOT EXISTS idx_postalpeek_feed_cache_lookup 
ON public.postalpeek_feed_cache(country, sort_index);

-- 2. Create the refresh function
CREATE OR REPLACE FUNCTION public.refresh_postalpeek_feed_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_country TEXT;
BEGIN
  -- Clear the existing cache
  TRUNCATE TABLE public.postalpeek_feed_cache;

  -- Insert up to 1000 random postcards for "Everywhere" (NULL country)
  -- We use ROW_NUMBER to generate a sequential index
  INSERT INTO public.postalpeek_feed_cache (id, country, sort_index)
  SELECT id, NULL, ROW_NUMBER() OVER ()
  FROM (
      SELECT id 
      FROM public.postalpeek_postcards
      ORDER BY random() 
      LIMIT 1000
  ) as random_everywhere;

  -- Loop through each distinct country and insert up to 500 for each
  FOR v_country IN (SELECT DISTINCT country FROM public.postalpeek_postcards WHERE country IS NOT NULL)
  LOOP
    INSERT INTO public.postalpeek_feed_cache (id, country, sort_index)
    SELECT id, v_country, ROW_NUMBER() OVER ()
    FROM (
        SELECT id 
        FROM public.postalpeek_postcards 
        WHERE country = v_country
        ORDER BY random() 
        LIMIT 500
    ) as random_country;
  END LOOP;
END;
$$;

-- 3. Update the RPC function to read from the cache
CREATE OR REPLACE FUNCTION public.postalpeek_get_random_feed(
  p_limit INT DEFAULT 10,
  p_country TEXT DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT '{}'
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_count INT;
BEGIN
  -- Check if cache has enough items for our query (in case it was just cleared or it's a new country)
  SELECT COUNT(*) INTO v_cache_count 
  FROM public.postalpeek_feed_cache 
  WHERE (p_country IS NULL AND country IS NULL) OR (country = p_country);

  IF v_cache_count > 0 THEN
    -- Happy Path: Serve from fast cache
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
    -- Fallback Path: Standard random if cache is empty or warming up
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

-- 4. Schedule the Cron Job (every 15 minutes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'postalpeek_feed_cache_refresh') THEN
    PERFORM cron.unschedule('postalpeek_feed_cache_refresh');
  END IF;
END $$;

SELECT cron.schedule(
  'postalpeek_feed_cache_refresh',
  '*/15 * * * *',
  $$
    SELECT public.refresh_postalpeek_feed_cache();
  $$
);

-- 5. Execute it once immediately so the cache isn't empty right now
SELECT public.refresh_postalpeek_feed_cache();
