CREATE TABLE public.btc_donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  txid text NOT NULL UNIQUE,
  donor_address text NOT NULL,
  donor_user_id uuid NOT NULL,
  sats bigint NOT NULL,
  bits_awarded bigint NOT NULL,
  status text NOT NULL DEFAULT 'credited',
  confirmed boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.btc_donations TO authenticated;
GRANT ALL ON public.btc_donations TO service_role;

ALTER TABLE public.btc_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors can read their own bitcoin donations"
ON public.btc_donations FOR SELECT TO authenticated
USING (donor_user_id = auth.uid() OR public.owns_wallet_address(donor_address));

CREATE TRIGGER btc_donations_touch
BEFORE UPDATE ON public.btc_donations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX btc_donations_donor_idx ON public.btc_donations (donor_address, created_at DESC);

CREATE OR REPLACE FUNCTION public.world_metrics()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'bit_circulating', COALESCE((SELECT sum(balance) FROM coin_balances), 0),
    'bit_earned_total', COALESCE((SELECT sum(earned_total) FROM coin_balances), 0),
    'holders', (SELECT count(*) FROM coin_balances WHERE balance > 0),
    'bit_minted_24h', COALESCE((SELECT sum(delta) FROM coin_ledger WHERE delta > 0 AND created_at > now() - interval '24 hours'), 0),
    'avg_goods_price', COALESCE((SELECT round(avg(public.goods_price(base_price, baseline_stock, stock))) FROM goods_market), 0),
    'goods_tracked', (SELECT count(*) FROM goods_market),
    'goods_stock', COALESCE((SELECT sum(stock) FROM goods_market), 0),
    'goods_volume_24h', COALESCE((SELECT sum(total_coins) FROM goods_trades WHERE created_at > now() - interval '24 hours'), 0),
    'goods_trades_24h', (SELECT count(*) FROM goods_trades WHERE created_at > now() - interval '24 hours'),
    'open_listings', (SELECT count(*) FROM market_listings WHERE status = 'open'),
    'mined_24h', COALESCE((SELECT sum(delta) FROM coin_ledger WHERE reason = 'miner_yield' AND delta > 0 AND created_at > now() - interval '24 hours'), 0),
    'mined_total', COALESCE((SELECT sum(delta) FROM coin_ledger WHERE reason = 'miner_yield' AND delta > 0), 0),
    'miners_24h', (SELECT count(DISTINCT address) FROM coin_ledger WHERE reason = 'miner_yield' AND created_at > now() - interval '24 hours'),
    'rigs', (SELECT count(*) FROM world_structures WHERE kind = 'btc-miner'),
    'builds', (SELECT count(*) FROM world_structures),
    'builds_24h', (SELECT count(*) FROM world_structures WHERE created_at > now() - interval '24 hours'),
    'donated_sats', COALESCE((SELECT sum(sats) FROM inscription_donations WHERE status = 'credited'), 0)
      + COALESCE((SELECT sum(sats) FROM btc_donations WHERE status = 'credited'), 0),
    'donated_bits', COALESCE((SELECT sum(bits_awarded) FROM inscription_donations WHERE status = 'credited'), 0)
      + COALESCE((SELECT sum(bits_awarded) FROM btc_donations WHERE status = 'credited'), 0)
  );
$$;

GRANT EXECUTE ON FUNCTION public.world_metrics() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.world_metrics_daily(_days integer DEFAULT 14)
RETURNS TABLE(day date, bit_minted bigint, mined bigint, trade_volume bigint, trades bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH span AS (
    SELECT generate_series(
      current_date - (GREATEST(LEAST(COALESCE(_days, 14), 90), 1) - 1),
      current_date,
      interval '1 day'
    )::date AS day
  )
  SELECT
    s.day,
    COALESCE((SELECT sum(l.delta) FROM coin_ledger l WHERE l.delta > 0 AND l.created_at::date = s.day), 0)::bigint,
    COALESCE((SELECT sum(l.delta) FROM coin_ledger l WHERE l.reason = 'miner_yield' AND l.delta > 0 AND l.created_at::date = s.day), 0)::bigint,
    COALESCE((SELECT sum(t.total_coins) FROM goods_trades t WHERE t.created_at::date = s.day), 0)::bigint,
    (SELECT count(*) FROM goods_trades t WHERE t.created_at::date = s.day)::bigint
  FROM span s
  ORDER BY s.day;
$$;

GRANT EXECUTE ON FUNCTION public.world_metrics_daily(integer) TO anon, authenticated;