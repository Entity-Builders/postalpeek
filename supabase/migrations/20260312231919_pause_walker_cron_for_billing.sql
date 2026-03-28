-- Pausing the walker cron to stop unexpected Gemini API billing which was running every minute
-- We use a DO block to safely unschedule if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'postalpeek_walker_cron') THEN
    PERFORM cron.unschedule('postalpeek_walker_cron');
  END IF;
END $$;

