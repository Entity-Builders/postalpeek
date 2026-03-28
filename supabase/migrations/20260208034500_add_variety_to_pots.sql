-- Add variety field to pots table for storing plant variety information
-- detected from image recognition (e.g., "Cherry Tomato", "San Marzano")

ALTER TABLE pots ADD COLUMN IF NOT EXISTS variety TEXT;
