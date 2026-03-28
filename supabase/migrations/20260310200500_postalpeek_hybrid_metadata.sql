-- Add metadata column to postalpeek_feed
ALTER TABLE public.postalpeek_feed
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create a helper RPC to fetch a random place from the Zigzag place table
-- This allows the Supabase client to efficiently pick one random location
CREATE OR REPLACE FUNCTION public.postalpeek_get_random_place()
RETURNS TABLE (
    id UUID,
    name TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, name, latitude, longitude
    FROM public.place
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    ORDER BY random()
    LIMIT 1;
$$;
