DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'coin_leaderboard_public'
      AND c.relkind IN ('v', 'm')
  ) THEN
    EXECUTE 'DROP VIEW public.coin_leaderboard_public';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.coin_leaderboard_public (
  rank bigint PRIMARY KEY,
  address_label text NOT NULL,
  balance bigint NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

GRANT SELECT ON public.coin_leaderboard_public TO anon, authenticated;
GRANT ALL ON public.coin_leaderboard_public TO service_role;

ALTER TABLE public.coin_leaderboard_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coin_leaderboard_public_read ON public.coin_leaderboard_public;
CREATE POLICY coin_leaderboard_public_read
ON public.coin_leaderboard_public
FOR SELECT
TO anon, authenticated
USING (true);

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

END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_coin_leaderboard_public() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.coin_balances_refresh_public_leaderboard_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.refresh_coin_leaderboard_public();
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.coin_balances_refresh_public_leaderboard_trigger() FROM PUBLIC;

DROP TRIGGER IF EXISTS coin_balances_refresh_public_leaderboard ON public.coin_balances;
CREATE TRIGGER coin_balances_refresh_public_leaderboard
AFTER INSERT OR UPDATE OR DELETE ON public.coin_balances
FOR EACH STATEMENT
EXECUTE FUNCTION public.coin_balances_refresh_public_leaderboard_trigger();

SELECT public.refresh_coin_leaderboard_public();