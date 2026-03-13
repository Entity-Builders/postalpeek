-- Add video_url column to postalpeek_postcards
ALTER TABLE public.postalpeek_postcards
ADD COLUMN video_url TEXT NULL;
