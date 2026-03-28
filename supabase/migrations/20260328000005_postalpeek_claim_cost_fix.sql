-- ============================================================
-- Fix postalpeek_claim_postcard to use dynamic rarity pricing
-- Aligning backend stamp cost logic with frontend
-- ============================================================

CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_stamp_cost INTEGER;
  v_balance    INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- 1. Get the stamp cost for this postcard (compute dynamically by rarity if stamp_cost is null)
  SELECT 
    COALESCE(
      stamp_cost, 
      CASE COALESCE(rarity, 'common')
        WHEN 'legendary' THEN 35
        WHEN 'epic'      THEN 15
        WHEN 'rare'      THEN 6
        ELSE 2
      END
    )
    INTO v_stamp_cost
    FROM postalpeek_postcards
   WHERE id = p_postcard_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'POSTCARD_NOT_FOUND');
  END IF;

  -- 2. Check stamp balance (create wallet row if missing)
  INSERT INTO postalpeek_stamp_balances (user_id, balance, total_earned, total_spent)
    VALUES (v_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance INTO v_balance
    FROM postalpeek_stamp_balances
   WHERE user_id = v_user_id;

  IF v_balance < v_stamp_cost THEN
    RETURN jsonb_build_object(
      'success',    false,
      'error',      'INSUFFICIENT_STAMPS',
      'balance',    v_balance,
      'stamp_cost', v_stamp_cost
    );
  END IF;

  -- 3. Atomic claim — only succeeds if postcard has no owner
  UPDATE postalpeek_postcards
     SET owner_id = v_user_id, claimed_at = NOW()
   WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- 4. Deduct stamps from new economy (atomic)
  UPDATE postalpeek_stamp_balances
     SET balance     = balance - v_stamp_cost,
         total_spent = total_spent + v_stamp_cost,
         updated_at  = now()
   WHERE user_id = v_user_id
  RETURNING balance INTO v_balance;

  -- 5. Log transaction
  INSERT INTO postalpeek_stamp_transactions
    (user_id, amount, type, reason, postcard_id)
  VALUES
    (v_user_id, -v_stamp_cost, 'claim', 'Certificación de postal', p_postcard_id);

  RETURN jsonb_build_object(
    'success',         true,
    'stamp_cost',      v_stamp_cost,
    'remaining_stamps', v_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_claim_postcard(UUID) TO authenticated;
