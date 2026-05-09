-- Add device_id column to postalpeek_usage_logs for device-based rate limiting
ALTER TABLE postalpeek_usage_logs ADD COLUMN IF NOT EXISTS device_id text;

-- Index for efficient device-based rate limit lookups
CREATE INDEX IF NOT EXISTS idx_usage_logs_device_id
  ON postalpeek_usage_logs(device_id)
  WHERE device_id IS NOT NULL;

-- Update postalpeek_config defaults: replace IP limits with device limits
INSERT INTO postalpeek_config (key, value)
VALUES ('max_daily_per_device', '5')
ON CONFLICT (key) DO NOTHING;
