-- RECREATE DISTINCT COUNTRIES RPC TO ORDER BY POSTCARD COUNT
CREATE OR REPLACE FUNCTION public.postalpeek_get_distinct_countries()
RETURNS TABLE (country text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT p.country
  FROM public.postalpeek_postcards p
  WHERE p.country IS NOT NULL
  GROUP BY p.country
  ORDER BY COUNT(*) DESC, p.country ASC;
$$;
