-- Create the postalpeek_feed table
CREATE TABLE IF NOT EXISTS public.postalpeek_feed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_name TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    original_image_url TEXT NOT NULL,
    illustration_url TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.postalpeek_feed ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Allow public read access on postalpeek_feed"
    ON public.postalpeek_feed
    FOR SELECT
    USING (true);

-- Create an index to quickly load the latest feed items
CREATE INDEX IF NOT EXISTS postalpeek_feed_created_at_idx ON public.postalpeek_feed (created_at DESC);

-- Ensure pg_net is enabled (required by supabase locally/hosted for HTTP requests in cron jobs)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the CRON job to run every 15 minutes
-- NOTE: In local dev, you'll need the supabase URL and anon key or service role key in the authorization header
-- Since pg_net requires absolute URLs, we'll invoke the function via pg_net
SELECT cron.schedule(
  'postalpeek_walker_cron',
  '*/15 * * * *', -- Every 15 minutes
  $$
    SELECT net.http_post(
        url:='http://kong:8000/functions/v1/postalpeek-cron-walker',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
