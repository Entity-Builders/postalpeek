-- Activating the walker cron schedule to run EVERY 1 HOUR (instead of every minute)
-- This controls the Google Gemini API costs while keeping the AI feed alive.
SELECT cron.schedule(
  'postalpeek_walker_cron',
  '0 * * * *', -- At minute 0 past every hour
  $$
    SELECT net.http_post(
        url:='https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/postalpeek-cron-walker',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
