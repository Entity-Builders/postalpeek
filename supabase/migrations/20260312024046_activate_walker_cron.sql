-- Activating the walker cron schedule safely using the cron schema function
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'walker_trigger'),
  schedule := '* * * * *',
  active := true
);
