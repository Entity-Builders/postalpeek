-- Protect stamp RPCs from stale JWTs (after db reset) throwing 409 Foreign Key Conflict

CREATE OR REPLACE FUNCTION postalpeek_get_stamp_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row postalpeek_stamp_balances%ROWTYPE;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('balance', 0, 'total_earned', 0, 'total_spent', 0, 'common', 0, 'rare', 0, 'epic', 0, 'legendary', 0);
  END IF;

  -- Protection against stale JWT / DB Reset
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object('balance', 0, 'total_earned', 0, 'total_spent', 0, 'common', 0, 'rare', 0, 'epic', 0, 'legendary', 0);
  END IF;

  -- Upsert wallet row if missing
  INSERT INTO postalpeek_stamp_balances (user_id, balance, total_earned, total_spent, common_balance, rare_balance, epic_balance, legendary_balance)
  VALUES (v_user_id, 0, 0, 0, 5, 1, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row
    FROM postalpeek_stamp_balances
   WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('balance', 0, 'total_earned', 0, 'total_spent', 0, 'common', 5, 'rare', 1, 'epic', 0, 'legendary', 0);
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

CREATE OR REPLACE FUNCTION postalpeek_claim_daily_stamps()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today       date := CURRENT_DATE;
  v_user_id     uuid := auth.uid();
  v_new_balance integer;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Idempotent: try to insert today's claim row
  INSERT INTO postalpeek_daily_stamp_claims (user_id, claimed_on)
    VALUES (v_user_id, v_today)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    SELECT balance INTO v_new_balance
      FROM postalpeek_stamp_balances
     WHERE user_id = v_user_id;

    RETURN jsonb_build_object('success', false, 'already_claimed', true, 'balance', COALESCE(v_new_balance, 0));
  END IF;

  v_new_balance := postalpeek_award_stamps(v_user_id, 2, 'daily_login', 'Bonus diario de Sellos');

  RETURN jsonb_build_object('success', true, 'already_claimed', false, 'balance', v_new_balance, 'awarded', 2);
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_claim_daily_stamps() TO authenticated;
