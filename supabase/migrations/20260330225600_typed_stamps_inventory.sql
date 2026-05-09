-- ============================================================
-- PostalPeek Typed Stamps Inventory Migration
-- Transition from generic stamp currency to Rarity-typed stamps
-- ============================================================

-- 1. Add Typed Stamp Balances to the Wallet
ALTER TABLE postalpeek_stamp_balances
ADD COLUMN IF NOT EXISTS common_balance INT NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS rare_balance INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS epic_balance INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS legendary_balance INT NOT NULL DEFAULT 0;

-- 2. Redefine claim RPC to use typed stamps
CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
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

  -- Check appropriate balance
  IF v_postcard_rarity = 'common' AND v_common <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_COMMON_STAMPS');
  ELSIF v_postcard_rarity = 'rare' AND v_rare <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_RARE_STAMPS');
  ELSIF v_postcard_rarity = 'epic' AND v_epic <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_EPIC_STAMPS');
  ELSIF v_postcard_rarity = 'legendary' AND v_legendary <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_LEGENDARY_STAMPS');
  END IF;

  -- Atomic claim
  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- Deduct typed stamp
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

  RETURN jsonb_build_object(
    'success', true, 
    'rarity_consumed', v_postcard_rarity,
    'remaining_stamps', CASE 
      WHEN v_postcard_rarity = 'common' THEN v_common - 1
      WHEN v_postcard_rarity = 'rare' THEN v_rare - 1
      WHEN v_postcard_rarity = 'epic' THEN v_epic - 1
      WHEN v_postcard_rarity = 'legendary' THEN v_legendary - 1
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_claim_postcard(UUID) TO authenticated;

-- 3. Redefine get_stamp_balance RPC to include typed balances
CREATE OR REPLACE FUNCTION postalpeek_get_stamp_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row postalpeek_stamp_balances%ROWTYPE;
BEGIN
  -- Upsert wallet row if missing
  INSERT INTO postalpeek_stamp_balances (user_id, balance, total_earned, total_spent, common_balance, rare_balance, epic_balance, legendary_balance)
  VALUES (auth.uid(), 0, 0, 0, 5, 1, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
    FROM postalpeek_stamp_balances
   WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'balance', 0, 
      'total_earned', 0, 
      'total_spent', 0,
      'common', 5,
      'rare', 1,
      'epic', 0,
      'legendary', 0
    );
  END IF;

  RETURN jsonb_build_object(
    'balance',       v_row.balance,
    'total_earned',  v_row.total_earned,
    'total_spent',   v_row.total_spent,
    'common',        v_row.common_balance,
    'rare',          v_row.rare_balance,
    'epic',          v_row.epic_balance,
    'legendary',     v_row.legendary_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_get_stamp_balance() TO authenticated;
