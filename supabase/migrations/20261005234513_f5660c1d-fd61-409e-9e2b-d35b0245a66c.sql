REVOKE ALL ON TABLE public.play_tournament_entrants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.play_tournament_entrants TO service_role;
CREATE POLICY "Tournament entrants have no direct access"
ON public.play_tournament_entrants
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.play_tournament_entrants IS 'Server-only tournament entrant secrets and identity links; no direct browser access.';

REVOKE ALL ON TABLE public.shadow_commitments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shadow_commitments TO service_role;
CREATE POLICY "Shadow commitments have no direct access"
ON public.shadow_commitments
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.shadow_commitments IS 'Server-only device-derived commitment hashes; reachable only through approved security-definer routines.';

REVOKE ALL ON TABLE public.shadow_spent_commitments FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shadow_spent_commitments TO service_role;
CREATE POLICY "Spent shadow commitments have no direct access"
ON public.shadow_spent_commitments
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.shadow_spent_commitments IS 'Server-only spent commitment hashes; reachable only through approved security-definer routines.';

REVOKE ALL ON TABLE public.shord_mint_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shord_mint_claims TO service_role;
CREATE POLICY "SHORD mint claims have no direct access"
ON public.shord_mint_claims
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.shord_mint_claims IS 'Server-only SHORD mint claim state; no direct browser access.';

REVOKE ALL ON TABLE public.shord_pool_deposits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shord_pool_deposits TO service_role;
CREATE POLICY "SHORD deposits have no direct access"
ON public.shord_pool_deposits
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.shord_pool_deposits IS 'Server-only SHORD pool deposit records containing wallet proof material; no direct browser access.';

REVOKE ALL ON TABLE public.shord_pool_withdrawals FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.shord_pool_withdrawals TO service_role;
CREATE POLICY "SHORD withdrawals have no direct access"
ON public.shord_pool_withdrawals
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
COMMENT ON TABLE public.shord_pool_withdrawals IS 'Server-only SHORD pool withdrawal records; no direct browser access.';