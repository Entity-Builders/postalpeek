-- postalpeek_cron_log: records each cron walker execution for admin observability
CREATE TABLE IF NOT EXISTS postalpeek_cron_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  slot_id       uuid REFERENCES postalpeek_album_slots(id) ON DELETE SET NULL,
  album_title   text,
  location_name text,
  strategy      text,
  postcard_id   uuid REFERENCES postalpeek_postcards(id) ON DELETE SET NULL,
  duration_ms   int,
  error_message text,
  triggered_by  text DEFAULT 'cron' -- 'cron' | 'admin'
);

-- Only admins / service role can read; no public access
ALTER TABLE postalpeek_cron_log ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS. Grant authenticated admins read access.
CREATE POLICY "Admins can read cron logs"
  ON postalpeek_cron_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can insert cron logs"
  ON postalpeek_cron_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Index for quick time-ordered queries
CREATE INDEX IF NOT EXISTS postalpeek_cron_log_created_at_idx
  ON postalpeek_cron_log (created_at DESC);
