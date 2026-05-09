-- Migration: postalpeek_admin_manage_typed_stamps
-- Description: Adds an RPC for admins to grant or delete specific rarity stamps.

CREATE OR REPLACE FUNCTION public.postalpeek_admin_manage_typed_stamps(
    p_user_email text,
    p_rarity text,
    p_amount integer,
    p_reason text DEFAULT 'Admin manual adjustment'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_new_balance integer;
    v_current_balance integer;
BEGIN
    -- 1. Get user_id by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_user_email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with email: %', p_user_email;
    END IF;

    -- Validations
    IF p_rarity NOT IN ('common', 'rare', 'epic', 'legendary') THEN
        RAISE EXCEPTION 'Invalid rarity: %', p_rarity;
    END IF;

    IF p_amount = 0 THEN
        RAISE EXCEPTION 'Amount must be non-zero';
    END IF;

    -- 2. Ensure user has a balance record
    INSERT INTO public.postalpeek_stamp_balances (user_id)
    VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Retrieve current balance
    IF p_rarity = 'common' THEN
        SELECT common_balance INTO v_current_balance FROM public.postalpeek_stamp_balances WHERE user_id = v_user_id;
    ELSIF p_rarity = 'rare' THEN
        SELECT rare_balance INTO v_current_balance FROM public.postalpeek_stamp_balances WHERE user_id = v_user_id;
    ELSIF p_rarity = 'epic' THEN
        SELECT epic_balance INTO v_current_balance FROM public.postalpeek_stamp_balances WHERE user_id = v_user_id;
    ELSIF p_rarity = 'legendary' THEN
        SELECT legendary_balance INTO v_current_balance FROM public.postalpeek_stamp_balances WHERE user_id = v_user_id;
    END IF;

    -- 4. Calculate new balance and validate deduction
    v_new_balance := v_current_balance + p_amount;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient % stamps. Cannot deduct %. Current balance is %.', p_rarity, ABS(p_amount), v_current_balance;
    END IF;

    -- 5. Update the balance
    IF p_rarity = 'common' THEN
        UPDATE public.postalpeek_stamp_balances
        SET common_balance = v_new_balance, updated_at = now()
        WHERE user_id = v_user_id;
    ELSIF p_rarity = 'rare' THEN
        UPDATE public.postalpeek_stamp_balances
        SET rare_balance = v_new_balance, updated_at = now()
        WHERE user_id = v_user_id;
    ELSIF p_rarity = 'epic' THEN
        UPDATE public.postalpeek_stamp_balances
        SET epic_balance = v_new_balance, updated_at = now()
        WHERE user_id = v_user_id;
    ELSIF p_rarity = 'legendary' THEN
        UPDATE public.postalpeek_stamp_balances
        SET legendary_balance = v_new_balance, updated_at = now()
        WHERE user_id = v_user_id;
    END IF;

    -- 6. Log transaction
    INSERT INTO public.postalpeek_stamp_transactions (
        user_id,
        amount,
        type,
        reference_id,
        metadata
    ) VALUES (
        v_user_id,
        p_amount, -- keep it positive or negative for visibility
        CASE WHEN p_amount > 0 THEN 'admin_grant' ELSE 'admin_deduct' END,
        v_user_id::text, -- Just referencing the user as context
        jsonb_build_object('reason', p_reason, 'rarity', p_rarity)
    );
END;
$$;

-- Ensure the function is accessible to authenticated users (so admin can call it via Edge or RPC)
GRANT EXECUTE ON FUNCTION public.postalpeek_admin_manage_typed_stamps(text, text, integer, text) TO authenticated;
