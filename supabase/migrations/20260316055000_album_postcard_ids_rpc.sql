-- RPC: Get all postcard IDs that belong to any active album
-- Combines slot-based albums AND dynamic match_rules albums
-- Used by the frontend to show album badges and confetti

CREATE OR REPLACE FUNCTION postalpeek_get_album_postcard_ids()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result UUID[];
BEGIN
  -- 1) Slot-based: postcards explicitly assigned to album slots
  SELECT ARRAY(
    SELECT DISTINCT s.postcard_id
    FROM postalpeek_album_slots s
    JOIN postalpeek_albums a ON a.id = s.album_id
    WHERE a.is_active = true
      AND s.postcard_id IS NOT NULL
  ) INTO v_result;

  -- 2) Dynamic match_rules: postcards that match any album's rules
  v_result := v_result || ARRAY(
    SELECT DISTINCT p.id
    FROM postalpeek_postcards p
    CROSS JOIN postalpeek_albums a
    WHERE a.is_active = true
      AND a.match_rules IS NOT NULL
      AND a.match_rules != '{}'::jsonb
      -- Country match
      AND (a.match_rules->>'country' IS NULL OR a.match_rules->>'country' = p.country)
      -- City match
      AND (a.match_rules->>'city' IS NULL OR a.match_rules->>'city' = p.city)
      -- Required tags: postcard must contain ALL
      AND (
        a.match_rules->'required_tags' IS NULL
        OR (p.visual_tags @> (a.match_rules->'required_tags'))
      )
      -- Any tags: postcard must contain at least ONE
      AND (
        a.match_rules->'any_tags' IS NULL
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(a.match_rules->'any_tags') tag
          WHERE p.visual_tags ? tag
        )
      )
  );

  -- Deduplicate and return as JSON array
  RETURN COALESCE(
    (SELECT jsonb_agg(DISTINCT id) FROM unnest(v_result) AS id),
    '[]'::jsonb
  );
END;
$$;
