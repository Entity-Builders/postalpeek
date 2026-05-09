ALTER TABLE postalpeek_postcards 
ADD COLUMN IF NOT EXISTS game_stats JSONB DEFAULT '{}'::jsonb;
