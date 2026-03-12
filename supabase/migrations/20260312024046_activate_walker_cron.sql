-- Activating the walker cron schedule
UPDATE cron.job 
SET active = true 
WHERE jobname = 'walker_trigger';
