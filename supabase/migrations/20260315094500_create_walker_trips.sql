-- Create the walker trips table
CREATE TABLE IF NOT EXISTS public.postalpeek_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    destination_query TEXT NOT NULL,
    itinerary_summary TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.postalpeek_trips ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access on postalpeek_trips"
    ON public.postalpeek_trips
    FOR SELECT
    USING (true);

-- Add trip concepts to postcards
ALTER TABLE public.postalpeek_postcards
ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES public.postalpeek_trips(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS trip_sequence INTEGER;
