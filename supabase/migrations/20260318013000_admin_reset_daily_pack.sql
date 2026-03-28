-- ============================================================
-- Admin Panel RPCs — SECURITY DEFINER to bypass RLS
-- Used exclusively by the admin console for dev/testing.
-- ============================================================

-- 1. Reset Daily Pack: unclaim postcards + delete pack entry
CREATE OR REPLACE FUNCTION postalpeek_admin_reset_daily_pack(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pack_ids UUID[];
BEGIN
  SELECT ARRAY(
    SELECT UNNEST(postcard_ids)
    FROM postalpeek_daily_packs
    WHERE user_id = p_user_id
      AND opened_at::date = CURRENT_DATE
  ) INTO v_pack_ids;

  IF array_length(v_pack_ids, 1) > 0 THEN
    UPDATE postalpeek_postcards
    SET owner_id = NULL, claimed_at = NULL
    WHERE id = ANY(v_pack_ids);
  END IF;

  DELETE FROM postalpeek_daily_packs
  WHERE user_id = p_user_id
    AND opened_at::date = CURRENT_DATE;
END;
$$;

-- 2. Unclaim All Postcards: remove ownership from all user's postcards
CREATE OR REPLACE FUNCTION postalpeek_admin_unclaim_all(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE postalpeek_postcards
  SET owner_id = NULL, claimed_at = NULL
  WHERE owner_id = p_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 3. Reset Claim Limits: no-op — postalpeek_claim_limits was removed in
--    migration 20260316185000. Daily packs are now the bottleneck.
CREATE OR REPLACE FUNCTION postalpeek_admin_reset_claims(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- postalpeek_claim_limits table no longer exists; this is intentionally a no-op.
  NULL;
END;
$$;

-- 4. Delete Postcard: hard delete a postcard by ID
CREATE OR REPLACE FUNCTION postalpeek_admin_delete_postcard(p_postcard_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM postalpeek_postcards WHERE id = p_postcard_id;
END;
$$;
