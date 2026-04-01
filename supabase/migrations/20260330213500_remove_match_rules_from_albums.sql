-- Remove match_rules dynamic album generation per user request.
-- Albums will now be exclusively based on literal slots (`postalpeek_album_slots`).
-- We remove the fallback logic from the SQL RPC functions and clear the columns.

-- 1. Simplify get_albums_with_progress to strictly count postalpeek_album_slots
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
      'total_slots', (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id),
      'collected_slots', (
        SELECT count(*) FROM postalpeek_album_slots s
        JOIN postalpeek_postcards p ON p.id = s.postcard_id
        WHERE s.album_id = a.id AND p.owner_id = v_user_id
      ),
      'completed_at', ap.completed_at
    ) AS album_row, a.created_at
    FROM postalpeek_albums a
    LEFT JOIN postalpeek_album_progress ap ON ap.album_id = a.id AND ap.user_id = v_user_id
    WHERE a.is_active = true
  ) sub;

  RETURN v_result;
END;
$$;

-- 2. Simplify get_album_detail to exclusively return postalpeek_album_slots
CREATE OR REPLACE FUNCTION postalpeek_get_album_detail(p_album_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_album RECORD;
  v_slots JSONB;
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

  -- SLOT-BASED ONLY: specific postcards per slot
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
      'match_rules', NULL,
      'reward_claims', v_album.reward_claims,
      'target_slots', v_album.target_slots
    ),
    'slots', v_slots,
    'completed_at', v_completed_at
  );
END;
$$;

-- 3. Clear existing match_rules data since we are dropping the feature for now
UPDATE postalpeek_albums SET match_rules = NULL;
