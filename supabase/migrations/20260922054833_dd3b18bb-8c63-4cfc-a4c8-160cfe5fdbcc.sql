-- 1. Bids: only a signed-in account that controls the wallet may create a bid
DROP POLICY IF EXISTS "bids_public_insert" ON public.bids;
CREATE POLICY "bids_insert_own_wallet"
ON public.bids FOR INSERT TO authenticated
WITH CHECK (status = 'open' AND public.owns_wallet_address(bidder_address));
REVOKE INSERT, UPDATE, DELETE ON public.bids FROM anon;
GRANT SELECT ON public.bids TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;

-- 2. Inscriptions: read-only for the public; the indexer writes with the service role
DROP POLICY IF EXISTS "inscriptions_public_insert" ON public.inscriptions;
DROP POLICY IF EXISTS "inscriptions_public_upsert_update" ON public.inscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.inscriptions FROM anon, authenticated;
GRANT SELECT ON public.inscriptions TO anon, authenticated;
GRANT ALL ON public.inscriptions TO service_role;

-- 3. Trades: read-only for the public; the trade indexer writes with the service role
DROP POLICY IF EXISTS "trades_public_insert" ON public.trades;
DROP POLICY IF EXISTS "trades_public_update" ON public.trades;
REVOKE INSERT, UPDATE, DELETE ON public.trades FROM anon, authenticated;
GRANT SELECT ON public.trades TO anon, authenticated;
GRANT ALL ON public.trades TO service_role;

-- 4. Public coin leaderboard: mask exact balances
CREATE OR REPLACE FUNCTION public.refresh_coin_leaderboard_public()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.coin_leaderboard_public WHERE rank >= 1;

  INSERT INTO public.coin_leaderboard_public (rank, address_label, balance, updated_at)
  SELECT
    ranked.rank,
    CASE
      WHEN length(ranked.address) <= 12 THEN ranked.address
      ELSE left(ranked.address, 6) || '…' || right(ranked.address, 6)
    END,
    -- masked: rounded down to the nearest 1,000 so exact holdings stay private
    (ranked.balance / 1000) * 1000,
    ranked.updated_at
  FROM (
    SELECT
      row_number() OVER (ORDER BY cb.balance DESC, cb.updated_at DESC) AS rank,
      cb.address,
      cb.balance,
      cb.updated_at
    FROM public.coin_balances cb
    WHERE cb.balance > 0
    ORDER BY cb.balance DESC, cb.updated_at DESC
    LIMIT 50
  ) ranked;
END;
$function$;
REVOKE ALL ON FUNCTION public.refresh_coin_leaderboard_public() FROM PUBLIC, anon, authenticated;
SELECT public.refresh_coin_leaderboard_public();

-- 5. Map chat: stop publishing account identifiers; publish a masked view instead
DROP POLICY IF EXISTS "Map chat is public to read" ON public.map_chat_messages;
CREATE POLICY "Authors read their own map chat"
ON public.map_chat_messages FOR SELECT TO authenticated
USING (auth.uid() = user_id);
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.map_chat_messages FROM anon;
GRANT SELECT, INSERT, DELETE ON public.map_chat_messages TO authenticated;
GRANT ALL ON public.map_chat_messages TO service_role;

DROP VIEW IF EXISTS public.map_chat_public;
CREATE VIEW public.map_chat_public
WITH (security_invoker = false) AS
SELECT
  m.id,
  m.visitor_id,
  m.handle,
  m.sender_address,
  m.district_height,
  m.body,
  m.created_at,
  (auth.uid() IS NOT NULL AND auth.uid() = m.user_id) AS is_mine
FROM public.map_chat_messages m;
GRANT SELECT ON public.map_chat_public TO anon, authenticated;