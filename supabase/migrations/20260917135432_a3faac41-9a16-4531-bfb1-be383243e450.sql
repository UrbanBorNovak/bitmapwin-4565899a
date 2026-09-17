DROP POLICY IF EXISTS coin_balances_public_read ON public.coin_balances;
DROP POLICY IF EXISTS coin_ledger_public_read ON public.coin_ledger;
DROP POLICY IF EXISTS coin_balances_owner_read ON public.coin_balances;
DROP POLICY IF EXISTS coin_ledger_owner_read ON public.coin_ledger;

REVOKE SELECT ON public.coin_balances FROM anon;
REVOKE SELECT ON public.coin_ledger FROM anon;
GRANT SELECT ON public.coin_balances TO authenticated;
GRANT SELECT ON public.coin_ledger TO authenticated;
GRANT ALL ON public.coin_balances TO service_role;
GRANT ALL ON public.coin_ledger TO service_role;

CREATE POLICY coin_balances_owner_read
ON public.coin_balances
FOR SELECT
TO authenticated
USING (public.owns_wallet_address(address));

CREATE POLICY coin_ledger_owner_read
ON public.coin_ledger
FOR SELECT
TO authenticated
USING (public.owns_wallet_address(address));

CREATE OR REPLACE FUNCTION public.coin_leaderboard(_limit integer DEFAULT 20)
RETURNS TABLE(rank bigint, address_label text, balance bigint, updated_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    ranked.rank,
    CASE
      WHEN length(ranked.address) <= 12 THEN ranked.address
      ELSE left(ranked.address, 6) || '…' || right(ranked.address, 6)
    END AS address_label,
    ranked.balance,
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
    LIMIT GREATEST(1, LEAST(COALESCE(_limit, 20), 50))
  ) ranked;
$function$;

REVOKE ALL ON FUNCTION public.coin_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coin_leaderboard(integer) TO anon, authenticated;

DROP POLICY IF EXISTS district_bitmaps_owner_insert ON public.district_bitmaps;

CREATE POLICY district_bitmaps_owner_insert
ON public.district_bitmaps
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.districts d
    JOIN public.wallet_links wl
      ON wl.user_id = auth.uid()
     AND lower(wl.address) = lower(d.owner_address)
    WHERE d.id = district_bitmaps.district_id
  )
  AND public.can_build_on_height(district_bitmaps.bitmap_height)
);