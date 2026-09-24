GRANT SELECT, INSERT, UPDATE ON public.wallet_profiles TO authenticated;
GRANT SELECT ON public.wallet_profiles TO anon;
GRANT ALL ON public.wallet_profiles TO service_role;