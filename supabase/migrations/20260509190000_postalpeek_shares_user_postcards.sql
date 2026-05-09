-- Alter postalpeek_shares to support user-generated postcards
ALTER TABLE public.postalpeek_shares
ADD COLUMN user_postcard_id UUID REFERENCES public.postalpeek_user_postcards(id) ON DELETE CASCADE;

-- Drop NOT NULL constraint on postcard_id to allow sharing user postcards
ALTER TABLE public.postalpeek_shares
ALTER COLUMN postcard_id DROP NOT NULL;

-- Add check constraint to ensure at least one postcard ID is provided
ALTER TABLE public.postalpeek_shares
ADD CONSTRAINT postalpeek_shares_must_have_postcard
CHECK (postcard_id IS NOT NULL OR user_postcard_id IS NOT NULL);
