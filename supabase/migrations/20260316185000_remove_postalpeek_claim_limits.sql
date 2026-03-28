-- Remove limits since Daily Packs are the new bottleneck
CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- Atomic claim — only succeeds if postcard has no owner
  UPDATE postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION postalpeek_get_claim_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object('daily_used', 0, 'daily_limit', 99999,
    'monthly_used', 0, 'monthly_limit', 99999);
END;
$$;
