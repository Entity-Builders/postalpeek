-- Add 'actions' column to tour_activity to separate the 'where' from the 'what'
ALTER TABLE "tour_activity" ADD COLUMN "actions" TEXT[] DEFAULT ARRAY[]::TEXT[];
