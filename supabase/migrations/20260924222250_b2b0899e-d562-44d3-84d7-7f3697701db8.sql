ALTER TABLE public.wallet_profiles
  ADD COLUMN IF NOT EXISTS residency_name text,
  ADD COLUMN IF NOT EXISTS residency_name_inscription_id text;

REVOKE SELECT ON public.wallet_profiles FROM anon, authenticated;
GRANT SELECT (address, display_name, bio, avatar_inscription_id, created_at, updated_at, residency_name, residency_name_inscription_id)
  ON public.wallet_profiles TO anon, authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;