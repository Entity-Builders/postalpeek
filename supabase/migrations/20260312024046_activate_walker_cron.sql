-- Activating the walker cron schedule by (re)creating it
SELECT cron.schedule(
  'postalpeek_walker_cron',
  '* * * * *',
  $$
    SELECT net.http_post(
        url:='https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/postalpeek-cron-walker',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
