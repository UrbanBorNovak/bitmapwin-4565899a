DROP POLICY IF EXISTS "Share market is public" ON public.player_stock;
CREATE POLICY "Open share markets are public"
  ON public.player_stock FOR SELECT
  TO anon, authenticated
  USING (is_open OR shares_issued > 0 OR public.owns_wallet_address(owner_address));

DROP POLICY IF EXISTS "Share trades are public" ON public.player_share_trades;
CREATE POLICY "Trades of issued shares are public"
  ON public.player_share_trades FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_stock ps
      WHERE ps.player_id = player_share_trades.player_id
        AND (ps.is_open OR ps.shares_issued > 0)
    )
  );

DROP POLICY IF EXISTS "Holder register is public" ON public.player_share_holdings;
CREATE POLICY "Register of issued shares is public"
  ON public.player_share_holdings FOR SELECT
  TO anon, authenticated
  USING (
    public.owns_wallet_address(holder_address)
    OR (
      shares > 0
      AND EXISTS (
        SELECT 1 FROM public.player_stock ps
        WHERE ps.player_id = player_share_holdings.player_id
          AND (ps.is_open OR ps.shares_issued > 0)
      )
    )
  );

DROP POLICY IF EXISTS "Dividend log is public" ON public.player_share_dividends;
CREATE POLICY "Payouts on issued shares are public"
  ON public.player_share_dividends FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.player_stock ps
      WHERE ps.player_id = player_share_dividends.player_id
        AND (ps.is_open OR ps.shares_issued > 0)
    )
  );

DROP POLICY IF EXISTS "PvP events are public" ON public.pvp_events;
CREATE POLICY "Recorded duels are public"
  ON public.pvp_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rank_players p WHERE p.id = pvp_events.killer_id)
    AND EXISTS (SELECT 1 FROM public.rank_players v WHERE v.id = pvp_events.victim_id)
  );