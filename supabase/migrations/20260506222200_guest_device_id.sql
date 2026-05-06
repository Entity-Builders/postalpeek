-- Make user_id nullable for guest postcards
ALTER TABLE postalpeek_user_postcards ALTER COLUMN user_id DROP NOT NULL;

-- Add device_id for guest identification
ALTER TABLE postalpeek_user_postcards ADD COLUMN device_id TEXT;
CREATE INDEX idx_user_postcards_device ON postalpeek_user_postcards(device_id) WHERE device_id IS NOT NULL;

-- Drop old insert policy
DROP POLICY IF EXISTS "user_postcards_insert" ON postalpeek_user_postcards;

-- Update RLS: allow guest inserts (no auth, but must provide device_id)
CREATE POLICY "user_postcards_insert" ON postalpeek_user_postcards
  FOR INSERT WITH CHECK (
    -- Either authenticated user inserting their own, OR guest with device_id
    (auth.uid() = user_id)
    OR (auth.uid() IS NULL AND user_id IS NULL AND device_id IS NOT NULL)
  );
