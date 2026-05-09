-- ─────────────────────────────────────────────────────────────────────────────
-- postalpeek_usage_logs
-- Tracks every call to postalpeek-illustrate (success, rate_limited, error).
-- Used for cost monitoring and rate limiting enforcement.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_usage_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type    text        NOT NULL DEFAULT 'illustration',
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address    inet,
  postcard_id   uuid,
  style         text,
  status        text        NOT NULL DEFAULT 'success',  -- 'success' | 'rate_limited' | 'error' | 'circuit_open'
  cost_usd      numeric(8,6),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast rate-limit queries (count by IP/user in time window)
CREATE INDEX IF NOT EXISTS idx_postalpeek_usage_created_at
  ON postalpeek_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_postalpeek_usage_ip_time
  ON postalpeek_usage_logs (ip_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_postalpeek_usage_user_time
  ON postalpeek_usage_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_postalpeek_usage_status
  ON postalpeek_usage_logs (status, created_at DESC);

-- RLS: edge function writes via service_role (bypasses RLS).
-- Authenticated users can read (admin gate is enforced at the app level).
ALTER TABLE postalpeek_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_usage_logs"
  ON postalpeek_usage_logs FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- postalpeek_config
-- Key-value store for runtime-configurable system parameters.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_config (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz DEFAULT now()
);

INSERT INTO postalpeek_config (key, value, description) VALUES
  ('max_daily_global',      '100',  'Max total illustration generations per calendar day (UTC)'),
  ('max_hourly_per_ip',     '3',    'Max generations per IP per rolling hour (anonymous)'),
  ('max_daily_per_ip',      '5',    'Max generations per IP per calendar day (anonymous)'),
  ('max_daily_per_user',    '10',   'Max generations per authenticated user per calendar day'),
  ('cost_per_generation',   '0.02', 'Estimated USD cost per Gemini illustration call'),
  ('rate_limiting_enabled', 'true', 'Master switch — set to false to disable all rate limiting')
ON CONFLICT (key) DO NOTHING;

-- Authenticated users can read config (admin gate at app level)
ALTER TABLE postalpeek_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_config"
  ON postalpeek_config FOR SELECT
  TO authenticated
  USING (true);
