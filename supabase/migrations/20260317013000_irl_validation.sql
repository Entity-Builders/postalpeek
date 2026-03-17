-- ============================================================
-- Phase 6: IRL Validation & Stamps
-- ============================================================

-- 1. Add Stamps Balance to Profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS stamps_balance INT DEFAULT 0;

-- 2. Create Validations Table
CREATE TABLE IF NOT EXISTS public.postalpeek_validations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    postcard_id UUID NOT NULL REFERENCES public.postalpeek_postcards(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    image_url TEXT,
    ai_reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for validations
ALTER TABLE public.postalpeek_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own validations" 
  ON public.postalpeek_validations FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own validations" 
  ON public.postalpeek_validations FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Note: Updates will be handled securely by the Edge Function via service_role

-- ============================================================
-- 3. Update Claim Logic to Cost 1 Stamp
-- ============================================================

CREATE OR REPLACE FUNCTION postalpeek_claim_postcard(p_postcard_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_stamps INT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'AUTH_REQUIRED');
  END IF;

  -- 1. Check stamps balance
  SELECT stamps_balance INTO v_stamps FROM public.profiles WHERE id = v_user_id;
  
  IF v_stamps IS NULL OR v_stamps < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_STAMPS');
  END IF;

  -- 2. Atomic claim — only succeeds if postcard has no owner
  UPDATE public.postalpeek_postcards
  SET owner_id = v_user_id, claimed_at = NOW()
  WHERE id = p_postcard_id AND owner_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ALREADY_CLAIMED');
  END IF;

  -- 3. Deduct stamp
  UPDATE public.profiles
  SET stamps_balance = stamps_balance - 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'remaining_stamps', v_stamps - 1);
END;
$$;
