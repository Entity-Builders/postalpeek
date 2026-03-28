CREATE OR REPLACE FUNCTION public.postalpeek_get_distinct_locations()
RETURNS TABLE (location_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT location_name
  FROM public.postalpeek_feed
  WHERE location_name IS NOT NULL
  ORDER BY location_name;
$$;
