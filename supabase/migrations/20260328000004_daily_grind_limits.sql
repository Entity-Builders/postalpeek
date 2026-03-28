-- ============================================================
-- PostalPeek: Daily Grind Limits
-- Adds last_played_at tracking to enforce 1-play-per-day rules.
-- ============================================================

-- Add last_played_at to postcards
ALTER TABLE public.postalpeek_postcards
ADD COLUMN IF NOT EXISTS last_played_at timestamp with time zone;

-- Update postalpeek_claim_game_reward to enforce the daily limit
CREATE OR REPLACE FUNCTION public.postalpeek_claim_game_reward(
  p_postcard_id uuid,
  p_game_type text
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
  v_last_played  timestamp with time zone;
  v_owner_id     uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- 1. Check ownership and daily limit
  SELECT owner_id, last_played_at
    INTO v_owner_id, v_last_played
    FROM public.postalpeek_postcards
   WHERE id = p_postcard_id;

  IF v_owner_id IS NULL OR v_owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;

  IF v_last_played IS NOT NULL AND v_last_played::date = now()::date THEN
    RETURN jsonb_build_object('success', false, 'error', 'DAILY_LIMIT_REACHED');
  END IF;

  -- 2. Ensure the user actually finished the game and hasn't claimed it yet
  SELECT true, reward_claimed
    INTO v_has_progress, v_is_claimed
    FROM public.postalpeek_game_progress
   WHERE user_id = v_user_id
     AND postcard_id = p_postcard_id
     AND game_type = p_game_type;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_GAME_PROGRESS');
  END IF;

  IF v_is_claimed THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- 3. Mark as claimed
  UPDATE public.postalpeek_game_progress
     SET reward_claimed = true
   WHERE user_id = v_user_id
     AND postcard_id = p_postcard_id
     AND game_type = p_game_type;

  -- 4. Update last_played_at on the postcard
  UPDATE public.postalpeek_postcards
     SET last_played_at = now()
   WHERE id = p_postcard_id;

  -- 5. Award 1 stamp
  v_new_balance := public.postalpeek_award_stamps(
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
