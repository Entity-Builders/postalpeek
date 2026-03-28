-- Extend tellee_profiles with business context fields
ALTER TABLE public.tellee_profiles
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS default_notes text;
