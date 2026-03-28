-- Disable the postalpeek_walker_cron to prevent accidental API quota consumption
SELECT cron.unschedule('postalpeek_walker_cron');
