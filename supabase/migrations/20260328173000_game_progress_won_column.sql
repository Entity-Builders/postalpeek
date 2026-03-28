-- ============================================================================
-- postalpeek_game_progress: Add won column
-- Automatically marks existing runs as won = true
-- ============================================================================

ALTER TABLE postalpeek_game_progress
ADD COLUMN IF NOT EXISTS won BOOLEAN DEFAULT true;
