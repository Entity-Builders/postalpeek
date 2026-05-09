CREATE TABLE IF NOT EXISTS postalpeek_system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE postalpeek_system_config ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users if needed, or anon
CREATE POLICY "Enable read access for all users"
  ON postalpeek_system_config FOR SELECT
  USING (true);

CREATE POLICY "Enable update for anon"
  ON postalpeek_system_config FOR UPDATE
  USING (true);

CREATE POLICY "Enable insert for anon"
  ON postalpeek_system_config FOR INSERT
  WITH CHECK (true);

-- Seed initial walker state
INSERT INTO postalpeek_system_config (key, value)
VALUES ('walker_state', '{"paused": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;
