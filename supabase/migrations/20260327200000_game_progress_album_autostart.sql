-- ============================================================================
-- postalpeek_game_progress: Track game completions per postcard per user
-- + Auto-start album trigger when a postcard gets an owner
-- ============================================================================

-- 1. Game progress tracking
CREATE TABLE IF NOT EXISTS postalpeek_game_progress (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  postcard_id UUID REFERENCES postalpeek_postcards(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL CHECK (game_type IN ('find_objects', 'puzzle', 'stamp_hunt')),
  completed_at TIMESTAMPTZ DEFAULT now(),
  time_seconds INT,
  PRIMARY KEY (user_id, postcard_id, game_type)
);

ALTER TABLE postalpeek_game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own game progress"
  ON postalpeek_game_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own game progress"
  ON postalpeek_game_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups by user+postcard
CREATE INDEX IF NOT EXISTS idx_game_progress_user_postcard
  ON postalpeek_game_progress(user_id, postcard_id);

-- 2. Auto-start album when a postcard gets an owner
--    (inserts into album_progress if the postcard belongs to an album)
CREATE OR REPLACE FUNCTION postalpeek_auto_start_album()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NEW.album_id IS NOT NULL THEN
    INSERT INTO postalpeek_album_progress (user_id, album_id)
    VALUES (NEW.owner_id, NEW.album_id)
    ON CONFLICT (user_id, album_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid duplicate trigger errors
DROP TRIGGER IF EXISTS trg_auto_start_album ON postalpeek_postcards;

CREATE TRIGGER trg_auto_start_album
  AFTER UPDATE OF owner_id ON postalpeek_postcards
  FOR EACH ROW
  WHEN (OLD.owner_id IS NULL AND NEW.owner_id IS NOT NULL)
  EXECUTE FUNCTION postalpeek_auto_start_album();
