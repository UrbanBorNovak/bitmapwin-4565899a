DROP POLICY IF EXISTS wallet_profiles_public_read ON public.wallet_profiles;

CREATE POLICY wallet_profiles_public_read
ON public.wallet_profiles
FOR SELECT
TO anon, authenticated
USING (
  address IS NOT NULL
  AND length(btrim(address)) BETWEEN 16 AND 120
);