-- Activity-Places junction table: multi-place activities + future tour stops
-- Pattern: reuse for tour_stops(tour_id, place_id, position, transport_mode)

-- 1. Create junction table
CREATE TABLE IF NOT EXISTS "activity_places" (
    "activity_id" TEXT NOT NULL REFERENCES "activity"("id") ON DELETE CASCADE,
    "place_id" UUID NOT NULL REFERENCES "place"("id") ON DELETE CASCADE,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'primary',

    CONSTRAINT "activity_places_pkey" PRIMARY KEY ("activity_id", "place_id")
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "idx_activity_places_activity" ON "activity_places" ("activity_id");
CREATE INDEX IF NOT EXISTS "idx_activity_places_place" ON "activity_places" ("place_id");

-- RLS: service role for writes, authenticated for reads
ALTER TABLE "activity_places" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON "activity_places"
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read" ON "activity_places"
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- 2. Backfill: migrate metadata.places → activity_places
INSERT INTO "activity_places" ("activity_id", "place_id", "position", "role")
SELECT
    a."id" AS activity_id,
    (place_obj->>'id')::UUID AS place_id,
    (place_idx)::SMALLINT AS position,
    CASE WHEN place_idx = 0 THEN 'primary' ELSE 'secondary' END AS role
FROM "activity" a,
    jsonb_array_elements(a."metadata"->'places') WITH ORDINALITY AS t(place_obj, place_idx)
WHERE a."metadata"->'places' IS NOT NULL
    AND jsonb_array_length(a."metadata"->'places') > 0
    AND (place_obj->>'id') IS NOT NULL
    AND EXISTS (SELECT 1 FROM "place" p WHERE p."id" = (place_obj->>'id')::UUID)
ON CONFLICT ("activity_id", "place_id") DO NOTHING;
