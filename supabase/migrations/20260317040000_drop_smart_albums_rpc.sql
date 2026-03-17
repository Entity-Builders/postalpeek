-- ============================================================
-- Phase 4: Search & Filter
-- Drops the old Smart Albums RPCs and renames the dictionary
-- table to be used for frontend filter chips.
-- ============================================================

-- 1. Drop the old Smart Albums RPC
DROP FUNCTION IF EXISTS public.postalpeek_get_smart_albums(UUID);

-- 2. Drop the custom type used by that RPC
DROP TYPE IF EXISTS public.postalpeek_smart_album_list CASCADE;

-- 3. Rename the rule dictionary to a generic filter tags table
ALTER TABLE IF EXISTS public.postalpeek_smart_album_rules
  RENAME TO postalpeek_filter_tags;

-- 4. Recreate the policy to match the new name (if needed, though it usually cascades)
-- Drop old policy if it exists on the new name
DROP POLICY IF EXISTS "Enable read access for all users" ON public.postalpeek_filter_tags;

CREATE POLICY "Enable read access for all users" ON public.postalpeek_filter_tags
    FOR SELECT USING (true);
