DROP POLICY IF EXISTS "Open share markets are public" ON public.player_stock;
CREATE POLICY "Open share markets are public"
  ON public.player_stock FOR SELECT TO anon
  USING (is_open OR shares_issued > 0);
CREATE POLICY "Open share markets are public to members"
  ON public.player_stock FOR SELECT TO authenticated
  USING (is_open OR shares_issued > 0 OR public.owns_wallet_address(owner_address));

DROP POLICY IF EXISTS "Register of issued shares is public" ON public.player_share_holdings;
CREATE POLICY "Register of issued shares is public"
  ON public.player_share_holdings FOR SELECT TO anon
  USING (shares > 0 AND EXISTS (SELECT 1 FROM public.player_stock ps WHERE ps.player_id = player_share_holdings.player_id AND (ps.is_open OR ps.shares_issued > 0)));
CREATE POLICY "Register of issued shares is public to members"
  ON public.player_share_holdings FOR SELECT TO authenticated
  USING (public.owns_wallet_address(holder_address) OR (shares > 0 AND EXISTS (SELECT 1 FROM public.player_stock ps WHERE ps.player_id = player_share_holdings.player_id AND (ps.is_open OR ps.shares_issued > 0))));