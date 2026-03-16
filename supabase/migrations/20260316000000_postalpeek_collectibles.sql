-- PostalPeek Collectibles: Phase 1 — Ownership + Claim Limits
-- This migration adds ownership mechanics to postcards

-- 1. Add ownership columns to postcards
ALTER TABLE postalpeek_postcards ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);
ALTER TABLE postalpeek_postcards ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE postalpeek_postcards ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT 'common'
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));

CREATE INDEX IF NOT EXISTS postalpeek_postcards_owner_idx ON postalpeek_postcards (owner_id);

-- 2. Create claim limits table
CREATE TABLE IF NOT EXISTS postalpeek_claim_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_claims_used INT DEFAULT 0,
  monthly_claims_used INT DEFAULT 0,
  last_daily_reset DATE DEFAULT CURRENT_DATE,
  last_monthly_reset DATE DEFAULT date_trunc('month', CURRENT_DATE)::date
);

ALTER TABLE postalpeek_claim_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own claim limits"
  ON postalpeek_claim_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own claim limits"
  ON postalpeek_claim_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own claim limits"
  ON postalpeek_claim_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Atomic claim RPC — prevents race conditions with FOR UPDATE + WHERE owner_id IS NULL
CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_daily_limit INT := 10;
  v_monthly_limit INT := 200;
  v_current_daily INT;
  v_current_monthly INT;
  v_last_daily DATE;
  v_last_monthly DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Upsert claim limits row
  INSERT INTO postalpeek_claim_limits (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current limits with row lock
  SELECT daily_claims_used, monthly_claims_used, last_daily_reset, last_monthly_reset
  INTO v_current_daily, v_current_monthly, v_last_daily, v_last_monthly
  FROM postalpeek_claim_limits
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Auto-reset daily counter
  IF v_last_daily < CURRENT_DATE THEN
    v_current_daily := 0;
  END IF;

  -- Auto-reset monthly counter
  IF v_last_monthly < date_trunc('month', CURRENT_DATE)::date THEN
    v_current_monthly := 0;
  END IF;

  -- Check daily limit
  IF v_current_daily >= v_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'DAILY_LIMIT_REACHED',
      'daily_used', v_current_daily, 'daily_limit', v_daily_limit);
  END IF;

  -- Check monthly limit
  IF v_current_monthly >= v_monthly_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'MONTHLY_LIMIT_REACHED',
      'monthly_used', v_current_monthly, 'monthly_limit', v_monthly_limit);
  END IF;

  -- Atomic claim — only succeeds if postcard has no owner
  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- Increment counters
  UPDATE postalpeek_claim_limits
  SET daily_claims_used = v_current_daily + 1,
      monthly_claims_used = v_current_monthly + 1,
      last_daily_reset = CURRENT_DATE,
      last_monthly_reset = date_trunc('month', CURRENT_DATE)::date
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true,
    'daily_used', v_current_daily + 1, 'daily_limit', v_daily_limit,
    'monthly_used', v_current_monthly + 1, 'monthly_limit', v_monthly_limit);
END;
$$;

-- 4. Get user collection RPC
CREATE OR REPLACE FUNCTION postalpeek_get_user_collection(p_user_id UUID)
RETURNS SETOF postalpeek_postcards
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT * FROM postalpeek_postcards
  WHERE owner_id = p_user_id
  ORDER BY claimed_at DESC;
$$;

-- 5. Get claim status RPC (current user)
CREATE OR REPLACE FUNCTION postalpeek_get_claim_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_daily INT := 0;
  v_monthly INT := 0;
  v_daily_limit INT := 10;
  v_monthly_limit INT := 200;
  v_last_daily DATE;
  v_last_monthly DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('daily_used', 0, 'daily_limit', v_daily_limit,
      'monthly_used', 0, 'monthly_limit', v_monthly_limit);
  END IF;

  SELECT daily_claims_used, monthly_claims_used, last_daily_reset, last_monthly_reset
  INTO v_daily, v_monthly, v_last_daily, v_last_monthly
  FROM postalpeek_claim_limits
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('daily_used', 0, 'daily_limit', v_daily_limit,
      'monthly_used', 0, 'monthly_limit', v_monthly_limit);
  END IF;

  -- Auto-reset
  IF v_last_daily < CURRENT_DATE THEN v_daily := 0; END IF;
  IF v_last_monthly < date_trunc('month', CURRENT_DATE)::date THEN v_monthly := 0; END IF;

  RETURN jsonb_build_object('daily_used', v_daily, 'daily_limit', v_daily_limit,
    'monthly_used', v_monthly, 'monthly_limit', v_monthly_limit);
END;
$$;
