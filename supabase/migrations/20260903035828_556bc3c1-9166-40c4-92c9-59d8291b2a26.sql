CREATE POLICY wallet_link_challenges_no_direct_access
ON public.wallet_link_challenges
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);