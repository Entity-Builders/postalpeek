-- PostalPeek Daily Pack: 5 free postcards per day with instant ownership
-- Table to log pack openings + RPC to atomically open a pack

-- 1. Daily packs tracking table
CREATE TABLE IF NOT EXISTS postalpeek_daily_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  postcard_ids UUID[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS postalpeek_daily_packs_user_day_idx
  ON postalpeek_daily_packs (user_id, opened_at);

ALTER TABLE postalpeek_daily_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own daily packs"
  ON postalpeek_daily_packs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System inserts daily packs"
  ON postalpeek_daily_packs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. Open daily pack RPC
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
  -- Auth check
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Check if user already opened a pack today
  SELECT * INTO v_existing_pack
  FROM postalpeek_daily_packs
  WHERE user_id = v_user_id AND opened_at::date = v_today
  ORDER BY opened_at DESC
  LIMIT 1;

  IF v_existing_pack.id IS NOT NULL THEN
    -- Already opened today — return the same cards
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

  -- Pick 5 random unclaimed postcards
  SELECT ARRAY(
    SELECT p.id
    FROM postalpeek_postcards p
    WHERE p.owner_id IS NULL
      AND p.illustration_url IS NOT NULL
      -- Only include postcards from completed trips or standalone ones
      AND (p.trip_id IS NULL OR EXISTS (
        SELECT 1 FROM postalpeek_trips t
        WHERE t.id = p.trip_id AND t.status = 'completed'
      ))
    ORDER BY random()
    LIMIT 5
  ) INTO v_picked_ids;

  -- If not enough cards available
  IF array_length(v_picked_ids, 1) IS NULL OR array_length(v_picked_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_CARDS_AVAILABLE');
  END IF;

  -- Bulk assign ownership
  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = ANY(v_picked_ids) AND owner_id IS NULL;

  -- Log the pack opening
  INSERT INTO postalpeek_daily_packs (user_id, postcard_ids)
  VALUES (v_user_id, v_picked_ids);

  -- Return the cards
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
