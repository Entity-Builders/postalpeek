-- Add sam2_masks column to store the array of segmented mask URLs
ALTER TABLE "public"."postalpeek_postcards" ADD COLUMN "sam2_masks" jsonb DEFAULT '[]'::jsonb;
