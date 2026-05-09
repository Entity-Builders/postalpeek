-- PostalPeek Schema Update: Add queue columns for robust background generation
ALTER TABLE postalpeek_album_slots
  ADD COLUMN IF NOT EXISTS heading DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS generation_metadata_override JSONB;
