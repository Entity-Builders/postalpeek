-- Add seed_type and notes columns to pots table
ALTER TABLE pots
  ADD COLUMN seed_type TEXT,
  ADD COLUMN notes TEXT;

COMMENT ON COLUMN pots.seed_type IS 'Type of seed (Heirloom, Hybrid, etc.)';
COMMENT ON COLUMN pots.notes IS 'Additional notes about the pot/plant';
