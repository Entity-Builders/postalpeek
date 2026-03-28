-- Ensure the extensions exist
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any previous schedule if it was created organically
SELECT cron.unschedule('postalpeek_walker_cron');

-- Re-create the CRON job to run every 15 minutes autonomously
SELECT cron.schedule(
  'postalpeek_walker_cron',
  '* * * * *', -- Every 1 minute
  $$
    SELECT net.http_post(
        url:='http://kong:8000/functions/v1/postalpeek-cron-walker',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
