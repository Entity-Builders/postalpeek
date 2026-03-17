-- PostalPeek Schema Cleanup: Merge trips → albums, drop deprecated tables
-- All renames use ALTER RENAME = zero data loss

-- ============================================================
-- STEP 1: Add trip-specific columns to postalpeek_albums
-- ============================================================
ALTER TABLE postalpeek_albums
  ADD COLUMN IF NOT EXISTS destination_query TEXT,
  ADD COLUMN IF NOT EXISTS itinerary_summary TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'curated';
-- source: 'curated' = manually created albums, 'walker' = auto-generated from walker trips

-- Make category nullable since walker-generated albums don't have categories
ALTER TABLE postalpeek_albums ALTER COLUMN category DROP NOT NULL;
ALTER TABLE postalpeek_albums ALTER COLUMN category SET DEFAULT 'travel';

-- ============================================================
-- STEP 2: Migrate trips data → albums (preserve UUIDs)
-- ============================================================
INSERT INTO postalpeek_albums (id, title, description, category, status, source, destination_query, itinerary_summary, created_at)
SELECT id, title, itinerary_summary, 'travel', status, 'walker', destination_query, itinerary_summary, created_at
FROM postalpeek_trips
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Add geo/stop columns to postalpeek_album_slots
-- ============================================================
ALTER TABLE postalpeek_album_slots
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS stop_description TEXT,
  ADD COLUMN IF NOT EXISTS stop_status TEXT DEFAULT 'completed';

-- ============================================================
-- STEP 4: Migrate trip_stops → album_slots
-- ============================================================
INSERT INTO postalpeek_album_slots (album_id, slot_label, slot_order, lat, lng, stop_description, stop_status)
SELECT trip_id, stop_name, sequence, lat, lng, stop_description, status
FROM postalpeek_trip_stops
ON CONFLICT DO NOTHING;

-- ============================================================
-- STEP 5: Rename columns on postalpeek_postcards
-- ============================================================
ALTER TABLE postalpeek_postcards RENAME COLUMN trip_id TO album_id;
ALTER TABLE postalpeek_postcards RENAME COLUMN trip_sequence TO album_sequence;

-- ============================================================
-- STEP 6: Drop deprecated tables
-- ============================================================
DROP TABLE IF EXISTS postalpeek_trip_stops CASCADE;
DROP TABLE IF EXISTS postalpeek_trips CASCADE;
DROP TABLE IF EXISTS postalpeek_claim_limits CASCADE;
DROP TABLE IF EXISTS postalpeek_daily_feed_state CASCADE;

-- Drop deprecated functions
DROP FUNCTION IF EXISTS postalpeek_get_daily_pack(UUID);
DROP FUNCTION IF EXISTS postalpeek_pop_from_pack(UUID);

-- ============================================================
-- STEP 7: Recreate RPCs with album_id instead of trip_id
-- ============================================================

-- 7a. postalpeek_get_random_feed (updated references)
DROP FUNCTION IF EXISTS public.postalpeek_get_random_feed(integer, text, uuid[], boolean);

CREATE OR REPLACE FUNCTION public.postalpeek_get_random_feed(
  p_limit INT DEFAULT 10,
  p_country TEXT DEFAULT NULL,
  p_exclude_ids UUID[] DEFAULT '{}',
  p_albums_only BOOLEAN DEFAULT FALSE
)
RETURNS SETOF public.postalpeek_postcards
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cache_count INT;
  v_album_inject_ids UUID[];
  v_remaining_limit INT;
BEGIN
  -- When filtering by albums, return only the FIRST postcard per COMPLETED album.
  IF p_albums_only THEN
    RETURN QUERY
    SELECT DISTINCT ON (p.album_id) p.*
    FROM public.postalpeek_postcards p
    JOIN public.postalpeek_albums a ON a.id = p.album_id
    WHERE
      p.album_id IS NOT NULL
      AND a.status = 'completed'
      AND (p_country IS NULL OR p.country = p_country)
      AND p.id != ALL(p_exclude_ids)
      AND p.illustration_url IS NOT NULL
    ORDER BY p.album_id, p.album_sequence ASC;
    RETURN;
  END IF;

  -- Step 1: Pick up to 2 random UNCLAIMED album-slot postcards
  SELECT ARRAY(
    SELECT s.postcard_id
    FROM postalpeek_album_slots s
    JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE p.owner_id IS NULL
      AND p.illustration_url IS NOT NULL
      AND s.postcard_id != ALL(p_exclude_ids)
      AND (p_country IS NULL OR p.country = p_country)
    ORDER BY random()
    LIMIT 2
  ) INTO v_album_inject_ids;

  -- Return album postcards first
  IF array_length(v_album_inject_ids, 1) > 0 THEN
    RETURN QUERY
    SELECT * FROM postalpeek_postcards WHERE id = ANY(v_album_inject_ids);
  END IF;

  -- Step 2: Fill the rest from normal feed
  v_remaining_limit := p_limit - COALESCE(array_length(v_album_inject_ids, 1), 0);

  SELECT COUNT(*) INTO v_cache_count
  FROM public.postalpeek_feed_cache
  WHERE (p_country IS NULL AND country IS NULL) OR (country = p_country);

  IF v_cache_count > 0 THEN
    RETURN QUERY
    SELECT p.*
    FROM public.postalpeek_feed_cache c
    JOIN public.postalpeek_postcards p ON c.id = p.id
    WHERE
      ((p_country IS NULL AND c.country IS NULL) OR (c.country = p_country))
      AND c.id != ALL(p_exclude_ids)
      AND c.id != ALL(v_album_inject_ids)
      -- Exclude postcards from incomplete albums
      AND (p.album_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_albums a
        WHERE a.id = p.album_id AND a.status = 'completed'
      ))
    ORDER BY c.sort_index ASC
    LIMIT v_remaining_limit;
  ELSE
    RETURN QUERY
    SELECT *
    FROM public.postalpeek_postcards
    WHERE
      (p_country IS NULL OR country = p_country)
      AND illustration_url IS NOT NULL
      AND id != ALL(p_exclude_ids)
      AND id != ALL(v_album_inject_ids)
      AND (album_id IS NULL OR EXISTS (
        SELECT 1 FROM public.postalpeek_albums a
        WHERE a.id = album_id AND a.status = 'completed'
      ))
    ORDER BY random()
    LIMIT v_remaining_limit;
  END IF;
END;
$$;

-- 7b. postalpeek_open_daily_pack (updated references)
CREATE OR REPLACE FUNCTION postalpeek_open_daily_pack()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := CURRENT_DATE;
  v_existing_pack postalpeek_daily_packs;
  v_picked_ids UUID[];
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT * INTO v_existing_pack
  FROM postalpeek_daily_packs
  WHERE user_id = v_user_id AND opened_at::date = v_today
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_existing_pack.id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'success', true,
      'already_opened', true,
      'pack_id', v_existing_pack.id,
      'postcards', COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
    ) INTO v_result
    FROM postalpeek_postcards p
    WHERE p.id = ANY(v_existing_pack.postcard_ids);
    RETURN v_result;
  END IF;

  SELECT ARRAY(
    SELECT p.id
    FROM postalpeek_postcards p
    WHERE p.owner_id IS NULL
      AND p.illustration_url IS NOT NULL
      AND (p.album_id IS NULL OR EXISTS (
        SELECT 1 FROM postalpeek_albums a
        WHERE a.id = p.album_id AND a.status = 'completed'
      ))
    ORDER BY random()
    LIMIT 5
  ) INTO v_picked_ids;

  IF array_length(v_picked_ids, 1) IS NULL OR array_length(v_picked_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_CARDS_AVAILABLE');
  END IF;

  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = ANY(v_picked_ids) AND owner_id IS NULL;

  INSERT INTO postalpeek_daily_packs (user_id, postcard_ids)
  VALUES (v_user_id, v_picked_ids);

  SELECT jsonb_build_object(
    'success', true,
    'already_opened', false,
    'postcards', COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
  ) INTO v_result
  FROM postalpeek_postcards p
  WHERE p.id = ANY(v_picked_ids);

  RETURN v_result;
END;
$$;

-- 7c. Drop the old 4-param version that used p_trips_only
DROP FUNCTION IF EXISTS public.postalpeek_get_random_feed(integer, text, uuid[], boolean);
