-- ============================================================
-- PostalPeek: Stamp Economy
-- Sellos (Stamps) are the in-game currency.
-- ============================================================

-- ── 1. Rarity Tiers price list ─────────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_stamp_rarities (
  tier           text PRIMARY KEY,
  cost_in_stamps integer NOT NULL DEFAULT 3,
  label_es       text NOT NULL,
  label_en       text NOT NULL,
  color          text NOT NULL DEFAULT '#9ca3af'
);

INSERT INTO postalpeek_stamp_rarities (tier, cost_in_stamps, label_es, label_en, color) VALUES
  ('common',    2,  'Común',     'Common',    '#9ca3af'),
  ('rare',      6,  'Rara',      'Rare',      '#60a5fa'),
  ('epic',      15, 'Épica',     'Epic',      '#a78bfa'),
  ('legendary', 35, 'Legendaria','Legendary', '#f59e0b')
ON CONFLICT (tier) DO NOTHING;

-- ── 2. Stamp cost column on postcards ──────────────────────

ALTER TABLE postalpeek_postcards
  ADD COLUMN IF NOT EXISTS stamp_cost integer NOT NULL DEFAULT 3;

-- ── 3. Wallet: one row per user ────────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_stamp_balances (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance      integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned integer NOT NULL DEFAULT 0,
  total_spent  integer NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE postalpeek_stamp_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stamp balance"
  ON postalpeek_stamp_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own stamp balance"
  ON postalpeek_stamp_balances FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 4. Ledger: every credit / debit ────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_stamp_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      integer NOT NULL,  -- positive = earn, negative = spend
  type        text NOT NULL,     -- 'onboarding' | 'daily_login' | 'minigame' | 'irl_validation' | 'claim' | 'trade'
  reason      text,
  postcard_id uuid REFERENCES postalpeek_postcards(id) ON DELETE SET NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE postalpeek_stamp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stamp transactions"
  ON postalpeek_stamp_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── 5. Daily claim tracking ────────────────────────────────

CREATE TABLE IF NOT EXISTS postalpeek_daily_stamp_claims (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_on date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, claimed_on)
);

ALTER TABLE postalpeek_daily_stamp_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily stamp claims"
  ON postalpeek_daily_stamp_claims FOR SELECT
  USING (auth.uid() = user_id);

-- ── 6. Internal award helper (SECURITY DEFINER) ─────────────

CREATE OR REPLACE FUNCTION postalpeek_award_stamps(
  p_user_id   uuid,
  p_amount    integer,
  p_type      text,
  p_reason    text DEFAULT NULL,
  p_postcard_id uuid DEFAULT NULL
)
RETURNS integer   -- returns new balance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  -- Upsert wallet row
  INSERT INTO postalpeek_stamp_balances (user_id, balance, total_earned)
    VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance      = postalpeek_stamp_balances.balance + p_amount,
        total_earned = postalpeek_stamp_balances.total_earned + p_amount,
        updated_at   = now()
  RETURNING balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO postalpeek_stamp_transactions (user_id, amount, type, reason, postcard_id)
    VALUES (p_user_id, p_amount, p_type, p_reason, p_postcard_id);

  RETURN v_new_balance;
END;
$$;

-- ── 7. Get balance RPC ─────────────────────────────────────

CREATE OR REPLACE FUNCTION postalpeek_get_stamp_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row postalpeek_stamp_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_row
    FROM postalpeek_stamp_balances
   WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('balance', 0, 'total_earned', 0, 'total_spent', 0);
  END IF;

  RETURN jsonb_build_object(
    'balance',       v_row.balance,
    'total_earned',  v_row.total_earned,
    'total_spent',   v_row.total_spent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_get_stamp_balance() TO authenticated;

-- ── 8. Daily login bonus (2 stamps/day, once per calendar day) ──

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
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Idempotent: try to insert today's claim row
  INSERT INTO postalpeek_daily_stamp_claims (user_id, claimed_on)
    VALUES (v_user_id, v_today)
  ON CONFLICT DO NOTHING;

  -- If no row was inserted → already claimed today
  IF NOT FOUND THEN
    SELECT balance INTO v_new_balance
      FROM postalpeek_stamp_balances
     WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'success',         false,
      'already_claimed', true,
      'balance',         COALESCE(v_new_balance, 0)
    );
  END IF;

  -- Award 2 stamps
  v_new_balance := postalpeek_award_stamps(v_user_id, 2, 'daily_login', 'Bonus diario de Sellos');

  RETURN jsonb_build_object(
    'success',         true,
    'already_claimed', false,
    'balance',         v_new_balance,
    'awarded',         2
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_claim_daily_stamps() TO authenticated;

-- ── 9. Spend stamps RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION postalpeek_spend_stamps(
  p_amount      integer,
  p_postcard_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_balance     integer;
  v_new_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  SELECT balance INTO v_balance
    FROM postalpeek_stamp_balances
   WHERE user_id = v_user_id;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'INSUFFICIENT_STAMPS',
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  -- Deduct from wallet
  UPDATE postalpeek_stamp_balances
     SET balance     = balance - p_amount,
         total_spent = total_spent + p_amount,
         updated_at  = now()
   WHERE user_id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO postalpeek_stamp_transactions (user_id, amount, type, reason, postcard_id)
    VALUES (v_user_id, -p_amount, 'claim', 'Certificación de postal', p_postcard_id);

  RETURN jsonb_build_object(
    'success',     true,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION postalpeek_spend_stamps(integer, uuid) TO authenticated;

-- ── 10. Onboarding trigger: 10 stamps on new user ──────────

CREATE OR REPLACE FUNCTION postalpeek_on_new_user_stamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM postalpeek_award_stamps(NEW.id, 10, 'onboarding', 'Bienvenido a PostalPeek 🏷️');
  RETURN NEW;
END;
$$;

-- Attach to auth.users INSERT (safe: CREATE OR REPLACE only replaces the function,
--  we drop+create the trigger to avoid duplicate)
DROP TRIGGER IF EXISTS postalpeek_new_user_stamps_trigger ON auth.users;

CREATE TRIGGER postalpeek_new_user_stamps_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION postalpeek_on_new_user_stamps();
