-- Activating the video poller cron schedule to run EVERY 10 MINUTES
-- This function checks Imagine.art API for completed videos and saves them.
SELECT cron.schedule(
  'postalpeek_video_poller_cron',
  '*/10 * * * *', -- At every 10th minute
  $$
    SELECT net.http_post(
        url:='https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/postalpeek-video-poller',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
