-- Add heading column to trip_stops for camera direction at each landmark
ALTER TABLE public.postalpeek_trip_stops
ADD COLUMN IF NOT EXISTS heading INTEGER DEFAULT 0;
