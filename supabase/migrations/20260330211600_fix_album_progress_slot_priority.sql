-- Fix: postalpeek_get_albums_with_progress must use slot-based counting
-- when an album has explicit postalpeek_album_slots, even if match_rules are set.
--
-- Game design context:
--   - Every album slot has a specific postcard (owner_id = NULL initially)
--   - Players claim/buy those specific postcards → sets their owner_id
--   - "collected_slots" = how many of those SPECIFIC slot postcards the user owns
--   - match_rules describe the THEME of the album, not the counting mechanism
--
-- Bug: the previous version checked match_rules first, causing "Discover Argentina Vol. 82"
-- to report collected_slots=8 by counting all user's Argentina cards, even though the
-- user actually owns 0 of the 8 specific slot postcards.
--
-- Fix priority: explicit slots > match_rules for counting purposes.
-- Also reverts get_album_detail to the same priority (explicit slots win).

-- ── 1. Fix get_albums_with_progress ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION postalpeek_get_albums_with_progress()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(album_row ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', a.id, 'title', a.title, 'description', a.description,
      'cover_image_url', a.cover_image_url, 'category', a.category,
      'country', a.country, 'city', a.city,
      'difficulty', a.difficulty,
      'reward_claims', a.reward_claims,
      'total_slots', CASE
        -- Slot-based album (explicit slots take priority)
        WHEN (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id) > 0
        THEN (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id)
        -- Dynamic album: use target_slots
        WHEN a.match_rules IS NOT NULL AND a.match_rules != '{}'::jsonb
        THEN a.target_slots
        ELSE 0
      END,
      'collected_slots', CASE
        -- Slot-based: count the specific slot postcards this user owns
        WHEN (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id) > 0
        THEN (
          SELECT count(*) FROM postalpeek_album_slots s
          JOIN postalpeek_postcards p ON p.id = s.postcard_id
          WHERE s.album_id = a.id AND p.owner_id = v_user_id
        )
        -- Dynamic: count user-owned postcards that match rules
        WHEN a.match_rules IS NOT NULL AND a.match_rules != '{}'::jsonb
        THEN LEAST((
          SELECT count(*) FROM postalpeek_postcards p
          WHERE p.owner_id = v_user_id
            AND (a.match_rules->>'country' IS NULL OR a.match_rules->>'country' = p.country)
            AND (a.match_rules->>'city' IS NULL OR a.match_rules->>'city' = p.city)
            AND (
              a.match_rules->'required_tags' IS NULL
              OR (p.visual_tags @> (a.match_rules->'required_tags'))
            )
            AND (
              a.match_rules->'any_tags' IS NULL
              OR EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(a.match_rules->'any_tags') tag
                WHERE p.visual_tags ? tag
              )
            )
        ), a.target_slots)
        ELSE 0
      END,
      'completed_at', ap.completed_at
    ) AS album_row, a.created_at
    FROM postalpeek_albums a
    LEFT JOIN postalpeek_album_progress ap ON ap.album_id = a.id AND ap.user_id = v_user_id
    WHERE a.is_active = true
  ) sub;

  RETURN v_result;
END;
$$;

-- ── 2. Revert get_album_detail to correct logic: explicit slots win ───────────

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

  -- Explicit slots take priority over match_rules
  SELECT EXISTS(SELECT 1 FROM postalpeek_album_slots WHERE album_id = p_album_id)
  INTO v_has_slots;

  IF v_has_slots THEN
    -- SLOT-BASED: specific postcards per slot
    -- is_owned = user owns that specific postcard
    -- is_claimed = someone else owns it (needs trading)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'slot_label', s.slot_label, 'slot_order', s.slot_order,
      'postcard_id', s.postcard_id,
      'illustration_url', p.illustration_url,
      'city', p.city, 'country', p.country, 'category', p.category,
      'is_owned', (p.owner_id = v_user_id),
      'is_claimed', (p.owner_id IS NOT NULL AND p.owner_id != v_user_id),
      'is_hint', false
    ) ORDER BY s.slot_order), '[]'::jsonb)
    INTO v_slots
    FROM postalpeek_album_slots s
    LEFT JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE s.album_id = p_album_id;
  ELSE
    -- DYNAMIC: generate virtual slots from match_rules
    WITH
    owned AS (
      SELECT p.id, p.illustration_url, p.city, p.country, p.category,
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
      SELECT p.id, p.illustration_url, p.city, p.country, p.category
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
          'slot_label', COALESCE(city, category::TEXT, 'Postal'),
          'slot_order', rn,
          'postcard_id', id,
          'illustration_url', illustration_url,
          'city', city, 'country', country, 'category', category,
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
          'slot_label', COALESCE(city, category::TEXT, '¿Qué será?'),
          'slot_order', (SELECT COALESCE(max(rn), 0) FROM owned) + 1,
          'postcard_id', id,
          'illustration_url', illustration_url,
          'city', city, 'country', country, 'category', category,
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
      'id', v_album.id,
      'title', v_album.title,
      'title_es', v_album.title_es,
      'title_en', v_album.title_en,
      'description', v_album.description,
      'description_es', v_album.description_es,
      'description_en', v_album.description_en,
      'cover_image_url', v_album.cover_image_url, 'category', v_album.category,
      'country', v_album.country, 'city', v_album.city,
      'difficulty', v_album.difficulty,
      'match_rules', v_album.match_rules,
      'reward_claims', v_album.reward_claims,
      'target_slots', v_album.target_slots
    ),
    'slots', v_slots,
    'completed_at', v_completed_at
  );
END;
$$;
