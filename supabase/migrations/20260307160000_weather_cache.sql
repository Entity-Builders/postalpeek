-- Weather Cache: shared weather data cache for all Entity Builders apps
-- Used by: ZigZag (activity suggestions), Potlink (plant care), future apps

CREATE TABLE IF NOT EXISTS "weather_cache" (
    "id" TEXT NOT NULL,           -- grid key: "lat_lng" (rounded ~200m)
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "data" JSONB NOT NULL,        -- full weather response (temp, humidity, wind, condition, etc.)
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "weather_cache_pkey" PRIMARY KEY ("id")
);

-- Fast lookup by coordinates
CREATE INDEX IF NOT EXISTS "idx_weather_cache_coords" ON "weather_cache" ("latitude", "longitude");

-- RLS: service role only (internal cache, not user-facing)
ALTER TABLE "weather_cache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON "weather_cache"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
