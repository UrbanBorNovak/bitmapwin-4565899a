DROP POLICY IF EXISTS offers_public_insert ON public.offers;
REVOKE INSERT ON public.offers FROM anon;
REVOKE INSERT ON public.offers FROM authenticated;
GRANT ALL ON public.offers TO service_role;