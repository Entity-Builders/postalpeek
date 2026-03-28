-- Add puzzle_url to postcards for the new sticker puzzle feature
ALTER TABLE public.postalpeek_postcards 
ADD COLUMN IF NOT EXISTS puzzle_url TEXT;
