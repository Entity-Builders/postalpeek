-- 1. DROP OLD OBJECTS
DROP FUNCTION IF EXISTS public.postalpeek_get_distinct_locations();

-- 2. CREATE NEW POSTCARDS TABLE WITH EXPLICIT GEOGRAPHY
CREATE TABLE IF NOT EXISTS public.postalpeek_postcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    location_name TEXT, -- Optional specific street or region
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    original_image_url TEXT NOT NULL,
    illustration_url TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    streetview_pov JSONB, -- Stores pitch, heading, fov, zoom used to capture it
    generation_metadata JSONB, -- Stores strategy used, vibe, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.postalpeek_postcards ENABLE ROW LEVEL SECURITY;

-- 4. READ POLICY
CREATE POLICY "Allow public read access on postalpeek_postcards"
    ON public.postalpeek_postcards
    FOR SELECT
    USING (true);

-- 5. CREATE INDEXES
CREATE INDEX IF NOT EXISTS postalpeek_postcards_created_at_idx ON public.postalpeek_postcards (created_at DESC);
CREATE INDEX IF NOT EXISTS postalpeek_postcards_country_idx ON public.postalpeek_postcards (country);

-- 6. RECREATE DISTINCT COUNTRIES RPC
CREATE OR REPLACE FUNCTION public.postalpeek_get_distinct_countries()
RETURNS TABLE (country text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT DISTINCT p.country
  FROM public.postalpeek_postcards p
  WHERE p.country IS NOT NULL
  ORDER BY p.country;
$$;
