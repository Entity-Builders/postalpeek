-- Migration: Add creator_name to postalpeek_user_postcards
-- Purpose: Store an anonymous display name for MVP users (no auth required).
--          This name is entered once after generating their first postcard.
--          When the user signs up later, their device_id postcards are linked
--          to their account and creator_name becomes their profile display name.
--
-- ref #94

ALTER TABLE postalpeek_user_postcards
  ADD COLUMN IF NOT EXISTS creator_name TEXT;
