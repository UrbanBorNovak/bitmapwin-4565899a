DROP FUNCTION IF EXISTS public.coin_leaderboard(integer);
DROP VIEW IF EXISTS public.coin_leaderboard_public;

CREATE VIEW public.coin_leaderboard_public AS
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
  LIMIT 50
) ranked;

GRANT SELECT ON public.coin_leaderboard_public TO anon, authenticated;
GRANT ALL ON public.coin_leaderboard_public TO service_role;