-- ============================================================================
-- Add target coordinates to album slots for precise landmark positioning
-- This ensures Street View opens at the actual landmark, not a random city location
-- ============================================================================

-- 1. Add target coordinate columns
ALTER TABLE postalpeek_album_slots
ADD COLUMN IF NOT EXISTS target_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS target_lng DOUBLE PRECISION;

-- 2. Populate with real landmark coordinates
UPDATE postalpeek_album_slots
SET target_lat = coords.lat, target_lng = coords.lng
FROM (VALUES
  -- Paris: Eiffel Tower
  ('🗼 Eiffel Tower',         48.8584,    2.2945),
  -- New York: Statue of Liberty
  ('🗽 Statue of Liberty',    40.6892,  -74.0445),
  -- Rome: Colosseum
  ('🏛️ Colosseum',            41.8902,   12.4922),
  -- London: Tower Bridge
  ('🏰 Tower Bridge',         51.5055,   -0.0754),
  -- Buenos Aires: Obelisco
  ('🎭 Obelisco',           -34.6037,  -58.3816),
  -- Rio de Janeiro: Cristo Redentor
  ('🗻 Cristo Redentor',    -22.9519,  -43.2105),
  -- Barcelona: Sagrada Familia
  ('⛪ Sagrada Familia',      41.4036,    2.1744),
  -- Mexico City: Palacio de Bellas Artes
  ('🏛️ Palacio de Bellas Artes', 19.4352, -99.1412),
  -- Cape Town: Table Mountain
  ('⛰️ Table Mountain',     -33.9625,   18.4036),
  -- Prague: Charles Bridge
  ('🏰 Charles Bridge',      50.0865,   14.4114)
) AS coords(label, lat, lng)
WHERE postalpeek_album_slots.slot_label = coords.label
  AND postalpeek_album_slots.album_id = '11111111-aaaa-4000-a000-000000000001';

-- 3. Update the RPC to prefer target coords over postcard coords
CREATE OR REPLACE FUNCTION postalpeek_get_album_detail(p_album_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_album RECORD;
  v_slots JSONB;
  v_has_slots BOOLEAN;
  v_user_id UUID := auth.uid();
  v_completed_at TIMESTAMPTZ;
BEGIN
  -- Get album info
  SELECT * INTO v_album FROM postalpeek_albums WHERE id = p_album_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Check if user completed this album
  SELECT completed_at INTO v_completed_at
  FROM postalpeek_album_progress
  WHERE user_id = v_user_id AND album_id = p_album_id;

  -- Check if album has explicit slots
  SELECT EXISTS(SELECT 1 FROM postalpeek_album_slots WHERE album_id = p_album_id)
  INTO v_has_slots;

  IF v_has_slots THEN
    -- SLOT-BASED: return full postcard data
    -- Use target_lat/target_lng from album slot if available, otherwise fall back to postcard coords
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'slot_label', s.slot_label, 'slot_order', s.slot_order,
      'postcard_id', s.postcard_id,
      'illustration_url', p.illustration_url,
      'original_image_url', p.original_image_url,
      'city', p.city, 'country', p.country, 'category', p.category,
      'lat', COALESCE(s.target_lat, p.lat),
      'lng', COALESCE(s.target_lng, p.lng),
      'is_owned', (p.owner_id = v_user_id),
      'is_claimed', (p.owner_id IS NOT NULL),
      'is_hint', false
    ) ORDER BY s.slot_order), '[]'::jsonb)
    INTO v_slots
    FROM postalpeek_album_slots s
    LEFT JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE s.album_id = p_album_id;
  ELSE
    -- DYNAMIC: generate virtual slots from match_rules (unchanged)
    WITH
    owned AS (
      SELECT p.id, p.illustration_url, p.city, p.country, p.category, p.lat, p.lng,
             row_number() OVER (ORDER BY p.claimed_at DESC) AS rn
      FROM postalpeek_postcards p
      WHERE p.owner_id = v_user_id
        AND (v_album.match_rules->>'country' IS NULL OR v_album.match_rules->>'country' = p.country)
        AND (v_album.match_rules->>'city' IS NULL OR v_album.match_rules->>'city' = p.city)
        AND (
          v_album.match_rules->'required_tags' IS NULL
          OR (p.visual_tags @> (v_album.match_rules->'required_tags'))
        )
        AND (
          v_album.match_rules->'any_tags' IS NULL
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_album.match_rules->'any_tags') tag
            WHERE p.visual_tags ? tag
          )
        )
      LIMIT v_album.target_slots
    ),
    hint AS (
      SELECT p.id, p.illustration_url, p.city, p.country, p.category, p.lat, p.lng
      FROM postalpeek_postcards p
      WHERE p.owner_id IS DISTINCT FROM v_user_id
        AND p.illustration_url IS NOT NULL
        AND (v_album.match_rules->>'country' IS NULL OR v_album.match_rules->>'country' = p.country)
        AND (v_album.match_rules->>'city' IS NULL OR v_album.match_rules->>'city' = p.city)
        AND (
          v_album.match_rules->'required_tags' IS NULL
          OR (p.visual_tags @> (v_album.match_rules->'required_tags'))
        )
        AND (
          v_album.match_rules->'any_tags' IS NULL
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_album.match_rules->'any_tags') tag
            WHERE p.visual_tags ? tag
          )
        )
        AND p.id NOT IN (SELECT id FROM owned)
      ORDER BY random()
      LIMIT 1
    ),
    numbered_owned AS (
      SELECT rn AS slot_order,
        jsonb_build_object(
          'slot_label', COALESCE(city, category, 'Postal'),
          'slot_order', rn,
          'postcard_id', id,
          'illustration_url', illustration_url,
          'city', city, 'country', country, 'category', category,
          'lat', lat, 'lng', lng,
          'is_owned', true,
          'is_claimed', true,
          'is_hint', false
        ) AS slot_data
      FROM owned
    ),
    hint_slot AS (
      SELECT
        (SELECT COALESCE(max(rn), 0) FROM owned) + 1 AS slot_order,
        jsonb_build_object(
          'slot_label', COALESCE(city, category, '¿Qué será?'),
          'slot_order', (SELECT COALESCE(max(rn), 0) FROM owned) + 1,
          'postcard_id', id,
          'illustration_url', illustration_url,
          'city', city, 'country', country, 'category', category,
          'lat', lat, 'lng', lng,
          'is_owned', false,
          'is_claimed', false,
          'is_hint', true
        ) AS slot_data
      FROM hint
    ),
    empty_slots AS (
      SELECT gs AS slot_order,
        jsonb_build_object(
          'slot_label', '???',
          'slot_order', gs,
          'postcard_id', NULL,
          'illustration_url', NULL,
          'city', NULL, 'country', NULL, 'category', NULL,
          'lat', NULL, 'lng', NULL,
          'is_owned', false,
          'is_claimed', false,
          'is_hint', false
        ) AS slot_data
      FROM generate_series(
        (SELECT COALESCE(max(rn), 0) FROM owned) + 2,
        v_album.target_slots
      ) AS gs
    ),
    all_slots AS (
      SELECT slot_order, slot_data FROM numbered_owned
      UNION ALL
      SELECT slot_order, slot_data FROM hint_slot
      UNION ALL
      SELECT slot_order, slot_data FROM empty_slots
    )
    SELECT COALESCE(jsonb_agg(slot_data ORDER BY slot_order), '[]'::jsonb)
    INTO v_slots
    FROM all_slots;
  END IF;

  RETURN jsonb_build_object(
    'album', jsonb_build_object(
      'id', v_album.id, 'title', v_album.title, 'description', v_album.description,
      'cover_image_url', v_album.cover_image_url, 'category', v_album.category,
      'country', v_album.country, 'city', v_album.city,
      'reward_claims', v_album.reward_claims, 'target_slots', v_album.target_slots
    ),
    'slots', v_slots,
    'completed_at', v_completed_at
  );
END;
$$;
