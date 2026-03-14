-- Random feed RPC for PostalPeek
-- Returns postcards in random order, with exclude_ids for infinite scroll pagination

CREATE OR REPLACE FUNCTION public.postalpeek_get_random_feed(
  p_limit INT DEFAULT 10,
  p_country TEXT DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT '{}'
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM public.postalpeek_postcards
  WHERE
    (p_country IS NULL OR country = p_country)
    AND id != ALL(p_exclude_ids)
  ORDER BY random()
  LIMIT p_limit;
$$;
