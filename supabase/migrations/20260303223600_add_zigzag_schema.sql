-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('SEQUENTIAL', 'SIMILAR', 'COMPLEMENTARY');

-- CreateTable
CREATE TABLE "activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT,
    "difficulty" "Difficulty",
    "duration" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "maxGroupSize" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location" JSONB,
    "address" TEXT,
    "sourceId" TEXT,
    "externalId" TEXT,
    "rating" DOUBLE PRECISION,
    "ratingCount" INTEGER,
    "formattedAddress" TEXT,
    "phoneNumber" TEXT,
    "website" TEXT,
    "businessStatus" TEXT,
    "priceLevel" INTEGER,
    "photos" JSONB,
    "openingHours" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "knownActivityTypeName" TEXT,

    CONSTRAINT "activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "known_activity_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "known_activity_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "duration" DOUBLE PRECISION,
    "maxGroupSize" INTEGER,
    "startDates" TIMESTAMP(3)[] DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "totalDays" INTEGER,
    "totalDistance" DOUBLE PRECISION,
    "estimatedBudget" DOUBLE PRECISION,
    "recommendedGroupSize" INTEGER,
    "coverImage" TEXT,
    "prompt" TEXT,
    "query" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_activity" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "activityId" TEXT,
    "startTime" TIMESTAMP(3),
    "duration" DOUBLE PRECISION,
    "notes" TEXT,
    "dayNumber" INTEGER,
    "travelTimeToNext" DOUBLE PRECISION,
    "distanceToNext" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 1,
    "activityName" TEXT,
    "activityType" TEXT,
    "activityLatitude" DOUBLE PRECISION,
    "activityLongitude" DOUBLE PRECISION,
    "activityData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tour_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crawler_search" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "deviceToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crawler_search_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'external',
    "baseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_relationship" (
    "id" TEXT NOT NULL,
    "sourceActivityId" TEXT NOT NULL,
    "targetActivityId" TEXT NOT NULL,
    "relationType" "RelationType" NOT NULL,
    "compatibilityScore" INTEGER NOT NULL,
    "timeCompatibilityScore" INTEGER NOT NULL,
    "distanceScore" INTEGER NOT NULL,
    "varietyScore" INTEGER NOT NULL,
    "timeGapRecommended" INTEGER,
    "reasoning" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_latitude_longitude_idx" ON "activity"("latitude", "longitude");
CREATE INDEX "activity_sourceId_idx" ON "activity"("sourceId");
CREATE UNIQUE INDEX "activity_sourceId_externalId_key" ON "activity"("sourceId", "externalId");
CREATE UNIQUE INDEX "known_activity_types_name_key" ON "known_activity_types"("name");
CREATE INDEX "tour_categories_idx" ON "tour"("categories");
CREATE INDEX "tour_activity_tourId_idx" ON "tour_activity"("tourId");
CREATE INDEX "tour_activity_activityId_idx" ON "tour_activity"("activityId");
CREATE UNIQUE INDEX "crawler_search_latitude_longitude_key" ON "crawler_search"("latitude", "longitude");
CREATE UNIQUE INDEX "source_name_key" ON "source"("name");
CREATE INDEX "activity_relationship_sourceActivityId_idx" ON "activity_relationship"("sourceActivityId");
CREATE INDEX "activity_relationship_targetActivityId_idx" ON "activity_relationship"("targetActivityId");
CREATE INDEX "activity_relationship_compatibilityScore_timeCompatibilityS_idx" ON "activity_relationship"("compatibilityScore", "timeCompatibilityScore", "distanceScore", "varietyScore");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity" ADD CONSTRAINT "activity_knownActivityTypeName_fkey" FOREIGN KEY ("knownActivityTypeName") REFERENCES "known_activity_types"("name") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tour_activity" ADD CONSTRAINT "tour_activity_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tour"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tour_activity" ADD CONSTRAINT "tour_activity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "activity_relationship" ADD CONSTRAINT "activity_relationship_sourceActivityId_fkey" FOREIGN KEY ("sourceActivityId") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_relationship" ADD CONSTRAINT "activity_relationship_targetActivityId_fkey" FOREIGN KEY ("targetActivityId") REFERENCES "activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ENABLE RLS
ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "known_activity_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tour" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tour_activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crawler_search" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_relationship" ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- Default baseline: Let authenticated users do everything. (Assuming we will refine this per app later)
CREATE POLICY "Enable read access for all users" ON "activity" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "activity" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON "known_activity_types" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "known_activity_types" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON "tour" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "tour" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON "tour_activity" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "tour_activity" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable all for authenticated users" ON "crawler_search" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON "source" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "source" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON "activity_relationship" FOR SELECT USING (true);
CREATE POLICY "Enable all for authenticated users" ON "activity_relationship" TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
