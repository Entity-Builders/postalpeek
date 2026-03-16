-- Fix hint slot: use relaxed matching with fallback to country/city

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
  SELECT * INTO v_album FROM postalpeek_albums WHERE id = p_album_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT completed_at INTO v_completed_at
  FROM postalpeek_album_progress
  WHERE user_id = v_user_id AND album_id = p_album_id;

  SELECT EXISTS(SELECT 1 FROM postalpeek_album_slots WHERE album_id = p_album_id)
  INTO v_has_slots;

  IF v_has_slots THEN
    -- SLOT-BASED: existing behavior
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'slot_label', s.slot_label, 'slot_order', s.slot_order,
      'postcard_id', s.postcard_id,
      'illustration_url', p.illustration_url,
      'city', p.city, 'country', p.country, 'category', p.category,
      'is_owned', (p.owner_id = v_user_id),
      'is_claimed', (p.owner_id IS NOT NULL),
      'is_hint', false
    ) ORDER BY s.slot_order), '[]'::jsonb)
    INTO v_slots
    FROM postalpeek_album_slots s
    LEFT JOIN postalpeek_postcards p ON p.id = s.postcard_id
    WHERE s.album_id = p_album_id;
  ELSE
    -- DYNAMIC: generate virtual slots from match_rules
    WITH
    -- User's owned postcards matching this album
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
    -- Hint: try exact match first, fallback to just country/city
    hint AS (
      (
        -- Try 1: exact rule match (not owned by user)
        SELECT p.id, p.illustration_url, p.city, p.country, p.category
        FROM postalpeek_postcards p
        WHERE p.illustration_url IS NOT NULL
          AND (v_user_id IS NULL OR p.owner_id IS DISTINCT FROM v_user_id)
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
      )
      UNION ALL
      (
        -- Try 2: fallback — any postcard from same country/city with illustration
        SELECT p.id, p.illustration_url, p.city, p.country, p.category
        FROM postalpeek_postcards p
        WHERE p.illustration_url IS NOT NULL
          AND (v_user_id IS NULL OR p.owner_id IS DISTINCT FROM v_user_id)
          AND (v_album.match_rules->>'country' IS NULL OR v_album.match_rules->>'country' = p.country)
          AND (v_album.match_rules->>'city' IS NULL OR v_album.match_rules->>'city' = p.city)
          AND p.id NOT IN (SELECT id FROM owned)
        ORDER BY random()
        LIMIT 1
      )
      LIMIT 1
    ),
    -- Build slots
    numbered_owned AS (
      SELECT rn AS slot_order,
        jsonb_build_object(
          'slot_label', COALESCE(city, category, 'Postal'),
          'slot_order', rn,
          'postcard_id', id,
          'illustration_url', illustration_url,
          'city', city, 'country', country, 'category', category,
          'is_owned', true, 'is_claimed', true, 'is_hint', false
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
          'is_owned', false, 'is_claimed', false, 'is_hint', true
        ) AS slot_data
      FROM hint
      LIMIT 1
    ),
    empty_slots AS (
      SELECT gs AS slot_order,
        jsonb_build_object(
          'slot_label', '???', 'slot_order', gs,
          'postcard_id', NULL, 'illustration_url', NULL,
          'city', NULL, 'country', NULL, 'category', NULL,
          'is_owned', false, 'is_claimed', false, 'is_hint', false
        ) AS slot_data
      FROM generate_series(
        (SELECT COALESCE(max(rn), 0) FROM owned)
          + 1
          + (SELECT count(*) FROM hint),  -- +1 if hint exists, +0 if not
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
      'reward_claims', v_album.reward_claims
    ),
    'slots', v_slots,
    'completed_at', v_completed_at
  );
END;
$$;
