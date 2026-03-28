-- ============================================================
-- PostalPeek: Game Rewards
-- Integrates the stamp economy with the mini-games.
-- ============================================================

-- 1. Add reward_claimed column to game progress
ALTER TABLE postalpeek_game_progress
  ADD COLUMN IF NOT EXISTS reward_claimed boolean NOT NULL DEFAULT false;

-- 2. RPC to securely claim the reward for a specific game completion
CREATE OR REPLACE FUNCTION postalpeek_claim_game_reward(
  p_postcard_id uuid,
  p_game_type   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_has_progress boolean;
  v_is_claimed   boolean;
  v_new_balance  integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Ensure the user actually finished the game and hasn't claimed it yet
  SELECT true, reward_claimed
    INTO v_has_progress, v_is_claimed
    FROM postalpeek_game_progress
   WHERE user_id = v_user_id
     AND postcard_id = p_postcard_id
     AND game_type = p_game_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_GAME_PROGRESS');
  END IF;

  IF v_is_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- Mark as claimed
  UPDATE postalpeek_game_progress
     SET reward_claimed = true
   WHERE user_id = v_user_id
     AND postcard_id = p_postcard_id
     AND game_type = p_game_type;

  -- Award 1 stamp
  v_new_balance := postalpeek_award_stamps(
    v_user_id,
    1,
    'minigame',
    'Desafío completado',
    p_postcard_id
  );

  RETURN jsonb_build_object(
    'success',     true,
    'awarded',     1,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_claim_game_reward(uuid, text) TO authenticated;
