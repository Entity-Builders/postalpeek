-- Fix: album progress listing must count dynamic matches, not just slots

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
        -- Dynamic album: use target_slots
        WHEN a.match_rules IS NOT NULL AND a.match_rules != '{}'::jsonb
        THEN a.target_slots
        -- Slot-based album: count actual slots
        ELSE (SELECT count(*) FROM postalpeek_album_slots WHERE album_id = a.id)
      END,
      'collected_slots', CASE
        -- Dynamic album: count user-owned postcards that match rules
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
        -- Slot-based album: count owned postcards in slots
        ELSE (
          SELECT count(*) FROM postalpeek_album_slots s
          JOIN postalpeek_postcards p ON p.id = s.postcard_id
          WHERE s.album_id = a.id AND p.owner_id = v_user_id
        )
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
