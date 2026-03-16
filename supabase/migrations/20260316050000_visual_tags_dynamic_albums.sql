-- Visual Tags & Dynamic Album Matching
-- Adds structured visual tags to postcards and match_rules to albums

-- 1. Add visual_tags column to postcards
ALTER TABLE postalpeek_postcards
  ADD COLUMN IF NOT EXISTS visual_tags JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS postalpeek_postcards_visual_tags_idx
  ON postalpeek_postcards USING GIN (visual_tags);

-- 2. Add difficulty + match_rules to albums
ALTER TABLE postalpeek_albums
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'easy'
    CHECK (difficulty IN ('easy', 'medium', 'hard', 'epic'));

ALTER TABLE postalpeek_albums
  ADD COLUMN IF NOT EXISTS match_rules JSONB DEFAULT '{}'::jsonb;

-- 3. RPC: Check which albums a postcard matches
-- match_rules format:
--   { "country": "Argentina", "city": "Buenos Aires",
--     "required_tags": ["colectivo"], "any_tags": ["bus", "transport"] }
CREATE OR REPLACE FUNCTION postalpeek_match_postcard_albums(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_postcard RECORD;
  v_matched_albums JSONB := '[]'::jsonb;
BEGIN
  SELECT country, city, category, visual_tags
  INTO v_postcard
  FROM postalpeek_postcards WHERE id = p_postcard_id;

  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title)), '[]'::jsonb)
  INTO v_matched_albums
  FROM postalpeek_albums a
  WHERE a.is_active = true
    AND a.match_rules != '{}'::jsonb
    -- Country match (if album specifies country)
    AND (a.match_rules->>'country' IS NULL OR a.match_rules->>'country' = v_postcard.country)
    -- City match (if album specifies city)
    AND (a.match_rules->>'city' IS NULL OR a.match_rules->>'city' = v_postcard.city)
    -- Tag match: postcard must contain ALL required tags
    AND (
      a.match_rules->'required_tags' IS NULL
      OR (v_postcard.visual_tags @> (a.match_rules->'required_tags'))
    )
    -- Tag match: postcard must contain at least ONE of the optional tags
    AND (
      a.match_rules->'any_tags' IS NULL
      OR EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(a.match_rules->'any_tags') tag
        WHERE v_postcard.visual_tags ? tag
      )
    );

  RETURN v_matched_albums;
END;
$$;

-- 4. Update albums listing RPC to include difficulty
CREATE OR REPLACE FUNCTION postalpeek_get_albums_with_progress()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(jsonb_agg(album_row ORDER BY created_at DESC), '[]'::jsonb)
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
        WHERE s.album_id = a.id AND p.owner_id = auth.uid()
      ),
      'completed_at', ap.completed_at
    ) AS album_row, a.created_at
    FROM postalpeek_albums a
    LEFT JOIN postalpeek_album_progress ap ON ap.album_id = a.id AND ap.user_id = auth.uid()
    WHERE a.is_active = true
  ) sub;
$$;
