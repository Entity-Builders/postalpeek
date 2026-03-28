-- Fix postalpeek_admin_reset_claims: postalpeek_claim_limits was dropped in
-- migration 20260316185000 but this RPC still referenced it, causing PGRST205.
-- Daily Packs are now the bottleneck — this RPC is now a safe no-op.
CREATE OR REPLACE FUNCTION postalpeek_admin_reset_claims(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- postalpeek_claim_limits table no longer exists; intentional no-op.
  NULL;
END;
$$;
