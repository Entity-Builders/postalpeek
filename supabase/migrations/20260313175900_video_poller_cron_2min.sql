-- Updating the video poller cron schedule to run EVERY 2 MINUTES
-- This function checks Imagine.art API for completed videos and saves them.
-- Status checks are free, only video generation (trigger) costs credits.
SELECT cron.schedule(
  'postalpeek_video_poller_cron',
  '*/2 * * * *', -- At every 2nd minute
  $$
    SELECT net.http_post(
        url:='https://xfcvuzcxvdpzkqpnahyx.supabase.co/functions/v1/postalpeek-video-poller',
        headers:='{"Content-Type": "application/json"}'::jsonb
    ) as request_id;
  $$
);
