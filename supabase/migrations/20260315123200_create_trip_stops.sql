-- Create the trip stops table for structured itineraries
CREATE TABLE IF NOT EXISTS public.postalpeek_trip_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.postalpeek_trips(id) ON DELETE CASCADE,
    stop_name TEXT NOT NULL,
    stop_description TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    sequence INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'skipped'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.postalpeek_trip_stops ENABLE ROW LEVEL SECURITY;

-- Public read access (same as trips)
CREATE POLICY "Allow public read access on postalpeek_trip_stops"
    ON public.postalpeek_trip_stops
    FOR SELECT
    USING (true);

-- Index for efficient lookups by trip
CREATE INDEX IF NOT EXISTS idx_trip_stops_trip_id 
    ON public.postalpeek_trip_stops(trip_id, sequence);

-- Index for pending stops lookup  
CREATE INDEX IF NOT EXISTS idx_trip_stops_pending 
    ON public.postalpeek_trip_stops(trip_id, status) 
    WHERE status = 'pending';
