-- ZigZag Phase 1: Schema Evolution
-- Adds: PostGIS, place table, user ownership on tours, transport modes

-- ============================================================
-- 1. ENABLE POSTGIS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- 2. CREATE PLACE TABLE
-- ============================================================
CREATE TABLE "place" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'point_of_interest',
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "geom" geography(POINT, 4326),
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "photos" JSONB DEFAULT '[]',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Auto-compute geom from lat/lng on insert/update
CREATE OR REPLACE FUNCTION place_set_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW."geom" := ST_MakePoint(NEW."longitude", NEW."latitude")::geography;
    NEW."updatedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER place_geom_trigger
    BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "place"
    FOR EACH ROW
    EXECUTE FUNCTION place_set_geom();

-- Spatial index for fast nearby queries
CREATE INDEX place_geom_idx ON "place" USING GIST ("geom");
CREATE INDEX place_type_idx ON "place" ("type");

-- ============================================================
-- 3. ADD user_id TO tour (ownership)
-- ============================================================
ALTER TABLE "tour" ADD COLUMN "userId" UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX tour_userId_idx ON "tour" ("userId");

-- ============================================================
-- 4. ADD transportMode TO tour_activity
-- ============================================================
ALTER TABLE "tour_activity" ADD COLUMN "transportMode" TEXT DEFAULT 'walk';

-- ============================================================
-- 5. ADD placeId TO activity (link activities to places)
-- ============================================================
ALTER TABLE "activity" ADD COLUMN "placeId" UUID REFERENCES "place"(id) ON DELETE SET NULL;
CREATE INDEX activity_placeId_idx ON "activity" ("placeId");

-- ============================================================
-- 6. ADD geom TO activity (for direct spatial queries)
-- ============================================================
ALTER TABLE "activity" ADD COLUMN "geom" geography(POINT, 4326);

CREATE OR REPLACE FUNCTION activity_set_geom()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."latitude" IS NOT NULL AND NEW."longitude" IS NOT NULL THEN
        NEW."geom" := ST_MakePoint(NEW."longitude", NEW."latitude")::geography;
    END IF;
    NEW."updatedAt" := CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_geom_trigger
    BEFORE INSERT OR UPDATE OF "latitude", "longitude" ON "activity"
    FOR EACH ROW
    EXECUTE FUNCTION activity_set_geom();

CREATE INDEX activity_geom_idx ON "activity" USING GIST ("geom");

-- ============================================================
-- 7. RPC: find_nearby_places
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearby_places(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    type TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    city TEXT,
    photos JSONB,
    metadata JSONB,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
    SELECT
        p.id,
        p.name,
        p.type,
        p.description,
        p.latitude,
        p.longitude,
        p.address,
        p.city,
        p.photos,
        p.metadata,
        ST_Distance(p."geom", ST_MakePoint(lng, lat)::geography) AS distance_meters
    FROM "place" p
    WHERE ST_DWithin(p."geom", ST_MakePoint(lng, lat)::geography, radius_meters)
    ORDER BY distance_meters;
$$;

-- ============================================================
-- 8. RPC: find_nearby_activities
-- ============================================================
CREATE OR REPLACE FUNCTION find_nearby_activities(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters DOUBLE PRECISION DEFAULT 1000
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    type TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address TEXT,
    price DOUBLE PRECISION,
    rating DOUBLE PRECISION,
    photos JSONB,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql STABLE
AS $$
    SELECT
        a.id,
        a.name,
        a.type,
        a.description,
        a.latitude,
        a.longitude,
        a.address,
        a.price,
        a.rating,
        a.photos,
        ST_Distance(a."geom", ST_MakePoint(lng, lat)::geography) AS distance_meters
    FROM "activity" a
    WHERE a."geom" IS NOT NULL
      AND ST_DWithin(a."geom", ST_MakePoint(lng, lat)::geography, radius_meters)
    ORDER BY distance_meters;
$$;

-- ============================================================
-- 9. RLS FOR place
-- ============================================================
ALTER TABLE "place" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON "place"
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "place"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for authenticated users" ON "place"
    FOR UPDATE TO authenticated
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 10. REFINE tour RLS (user ownership)
-- ============================================================
-- Drop old broad policies
DROP POLICY IF EXISTS "Enable all for authenticated users" ON "tour";

-- Users can read all tours
-- (Keep existing "Enable read access for all users" policy)

-- Users can insert their own tours
CREATE POLICY "Enable insert own tours" ON "tour"
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = "userId" OR "userId" IS NULL);

-- Users can update their own tours
CREATE POLICY "Enable update own tours" ON "tour"
    FOR UPDATE TO authenticated
    USING (auth.uid() = "userId" OR "userId" IS NULL)
    WITH CHECK (auth.uid() = "userId" OR "userId" IS NULL);

-- Users can delete their own tours
CREATE POLICY "Enable delete own tours" ON "tour"
    FOR DELETE TO authenticated
    USING (auth.uid() = "userId");
