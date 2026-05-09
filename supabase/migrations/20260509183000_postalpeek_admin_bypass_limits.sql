-- ============================================================
-- PostalPeek Admin Bypass Limits
-- Gives juanobrach@gmail.com superpowers (no stamp/daily limits)
-- ============================================================

-- 1. Redefine claim RPC to bypass typed stamp limits for admin
CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_postcard_rarity TEXT;
  v_common INT;
  v_rare INT;
  v_epic INT;
  v_legendary INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Upsert wallet row if not exists (Starter pack)
  INSERT INTO postalpeek_stamp_balances (user_id, balance, total_earned, total_spent, common_balance, rare_balance, epic_balance, legendary_balance)
  VALUES (v_user_id, 0, 0, 0, 5, 1, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get postcard rarity
  SELECT COALESCE(rarity, 'common') INTO v_postcard_rarity
  FROM postalpeek_postcards
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF v_postcard_rarity IS NULL THEN
    -- Either it doesn't exist or it's already claimed
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED_OR_NOT_FOUND');
  END IF;

  -- Get user balances with row lock
  SELECT common_balance, rare_balance, epic_balance, legendary_balance
  INTO v_common, v_rare, v_epic, v_legendary
  FROM postalpeek_stamp_balances
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Get user email to check for admin bypass
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- Check appropriate balance
  IF v_user_email != 'juanobrach@gmail.com' THEN
    IF v_postcard_rarity = 'common' AND v_common <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_COMMON_STAMPS');
    ELSIF v_postcard_rarity = 'rare' AND v_rare <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_RARE_STAMPS');
    ELSIF v_postcard_rarity = 'epic' AND v_epic <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_EPIC_STAMPS');
    ELSIF v_postcard_rarity = 'legendary' AND v_legendary <= 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_LEGENDARY_STAMPS');
    END IF;
  END IF;

  -- Atomic claim
  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- Deduct typed stamp
  IF v_user_email != 'juanobrach@gmail.com' THEN
    UPDATE postalpeek_stamp_balances
    SET 
      common_balance = CASE WHEN v_postcard_rarity = 'common' THEN common_balance - 1 ELSE common_balance END,
      rare_balance = CASE WHEN v_postcard_rarity = 'rare' THEN rare_balance - 1 ELSE rare_balance END,
      epic_balance = CASE WHEN v_postcard_rarity = 'epic' THEN epic_balance - 1 ELSE epic_balance END,
      legendary_balance = CASE WHEN v_postcard_rarity = 'legendary' THEN legendary_balance - 1 ELSE legendary_balance END,
      updated_at = now()
    WHERE user_id = v_user_id;

    -- Log transaction
    INSERT INTO postalpeek_stamp_transactions
      (user_id, amount, type, reason, postcard_id, metadata)
    VALUES
      (v_user_id, -1, 'claim_typed', 'Certificación de postal por rareza', p_postcard_id, jsonb_build_object('rarity_spent', v_postcard_rarity));
  ELSE
    -- Log transaction for admin
    INSERT INTO postalpeek_stamp_transactions
      (user_id, amount, type, reason, postcard_id, metadata)
    VALUES
      (v_user_id, 0, 'claim_typed', 'Certificación de postal por rareza (Admin Bypass)', p_postcard_id, jsonb_build_object('rarity_spent', v_postcard_rarity));
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'rarity_consumed', v_postcard_rarity,
    'remaining_stamps', CASE 
      WHEN v_postcard_rarity = 'common' THEN CASE WHEN v_user_email = 'juanobrach@gmail.com' THEN v_common ELSE v_common - 1 END
      WHEN v_postcard_rarity = 'rare' THEN CASE WHEN v_user_email = 'juanobrach@gmail.com' THEN v_rare ELSE v_rare - 1 END
      WHEN v_postcard_rarity = 'epic' THEN CASE WHEN v_user_email = 'juanobrach@gmail.com' THEN v_epic ELSE v_epic - 1 END
      WHEN v_postcard_rarity = 'legendary' THEN CASE WHEN v_user_email = 'juanobrach@gmail.com' THEN v_legendary ELSE v_legendary - 1 END
    END
  );
END;
$$;

-- 2. Update postalpeek_claim_game_reward to enforce the daily limit EXCEPT for admin
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
  v_user_email   text;
  v_has_progress boolean;
  v_is_claimed   boolean;
  v_new_balance  integer;
  v_last_played  timestamp with time zone;
  v_owner_id     uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 1. Check ownership and daily limit
  SELECT owner_id, last_played_at
    INTO v_owner_id, v_last_played
    FROM public.postalpeek_postcards
   WHERE id = p_postcard_id;

  IF v_owner_id IS NULL OR v_owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_OWNER');
  END IF;

  IF v_user_email != 'juanobrach@gmail.com' AND v_last_played IS NOT NULL AND v_last_played::date = now()::date THEN
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
    'Desafío completado' || CASE WHEN v_user_email = 'juanobrach@gmail.com' THEN ' (Admin Bypass)' ELSE '' END,
    p_postcard_id
  );

  RETURN jsonb_build_object(
    'success',     true,
    'awarded',     1,
    'new_balance', v_new_balance
  );
END;
$$;
