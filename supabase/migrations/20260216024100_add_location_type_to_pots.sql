-- Add location_type column to pots table
ALTER TABLE pots ADD COLUMN location_type TEXT DEFAULT 'outdoor';
