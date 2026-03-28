-- Enrichment Engine Phase 1: active_zone tracking + activity indexes

-- 1. active_zone table: tracks where users open the app
CREATE TABLE IF NOT EXISTS "active_zone" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "city" TEXT,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "active_zone_pkey" PRIMARY KEY ("id")
);

-- 2. Indexes for fast activity queries by zone + moment
CREATE INDEX IF NOT EXISTS activity_type_created_idx
  ON "activity"("type", "createdAt")
  WHERE "type" = 'ai_suggested';

CREATE INDEX IF NOT EXISTS activity_metadata_cache_key_idx
  ON "activity" USING gin("metadata" jsonb_path_ops);

-- 3. RLS
ALTER TABLE "active_zone" ENABLE ROW LEVEL SECURITY;

-- Service role can fully manage (edge functions use service_role key)
CREATE POLICY "Service role full access" ON "active_zone"
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can read (for debugging/analytics)
CREATE POLICY "Authenticated read" ON "active_zone"
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert/update (tracking their zone)
CREATE POLICY "Authenticated upsert" ON "active_zone"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update" ON "active_zone"
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. RPC for atomic counter increment
CREATE OR REPLACE FUNCTION increment_zone_count(zone_id TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE active_zone
  SET request_count = request_count + 1,
      last_seen_at = now()
  WHERE id = zone_id;
$$;
