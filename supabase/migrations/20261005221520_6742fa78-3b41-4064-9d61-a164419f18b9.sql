CREATE OR REPLACE FUNCTION public.archaeology_ledger()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '15s' AS $$
  WITH sellers AS (SELECT DISTINCT seller_address a FROM trades WHERE seller_address IS NOT NULL),
  eras AS (
    SELECT jsonb_build_object(
      'vanguard', count(*) FILTER (WHERE genesis_height < 793500),
      'rush', count(*) FILTER (WHERE genesis_height >= 793500 AND genesis_height < 796000),
      'consolidation', count(*) FILTER (WHERE genesis_height >= 796000 AND genesis_height < 800000),
      'modern', count(*) FILTER (WHERE genesis_height >= 800000),
      'total', count(*)) j
    FROM bitmap_index WHERE is_valid AND genesis_height IS NOT NULL),
  vanguard AS (
    SELECT coalesce(jsonb_agg(x ORDER BY x.held DESC, x.first_genesis), '[]') j FROM (
      SELECT owner_address address, count(*) held, min(genesis_height) first_genesis, min(block_height) lowest_block
      FROM bitmap_index WHERE is_valid AND genesis_height < 793500 AND owner_address IS NOT NULL
      GROUP BY 1 ORDER BY 2 DESC, 3 LIMIT 20) x),
  diamond AS (
    SELECT coalesce(jsonb_agg(x ORDER BY x.held DESC), '[]') j FROM (
      SELECT b.owner_address address, count(*) held,
        count(*) FILTER (WHERE b.genesis_height < 793500) vanguard
      FROM bitmap_index b WHERE b.is_valid AND b.genesis_height < 796000 AND b.owner_address IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM sellers s WHERE s.a = b.owner_address)
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x),
  traders AS (
    SELECT coalesce(jsonb_agg(x ORDER BY x.trades DESC), '[]') j FROM (
      SELECT address, count(*) trades, count(*) FILTER (WHERE side='B') buys, count(*) FILTER (WHERE side='S') sells, sum(price_sats) volume_sats FROM (
        SELECT buyer_address address, 'B' side, price_sats FROM trades WHERE buyer_address IS NOT NULL
        UNION ALL SELECT seller_address, 'S', price_sats FROM trades WHERE seller_address IS NOT NULL) t
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x)
  SELECT jsonb_build_object('eras', eras.j, 'vanguard', vanguard.j, 'diamond', diamond.j, 'traders', traders.j,
    'traced_sales', (SELECT count(*) FROM trades))
  FROM eras, vanguard, diamond, traders;
$$;
GRANT EXECUTE ON FUNCTION public.archaeology_ledger() TO anon, authenticated, service_role;