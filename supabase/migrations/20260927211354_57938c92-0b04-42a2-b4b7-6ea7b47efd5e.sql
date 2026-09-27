CREATE TABLE public.block_facts (
  block_height bigint PRIMARY KEY,
  block_hash text NOT NULL,
  mined_at timestamptz NOT NULL,
  size_bytes integer NOT NULL,
  total_output_sats bigint,
  avg_fee_rate numeric,
  coinbase_text text,
  pool_name text,
  btc_usd numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.block_facts TO anon, authenticated;
GRANT ALL ON public.block_facts TO service_role;
ALTER TABLE public.block_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Block facts are public" ON public.block_facts FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX block_facts_output_idx ON public.block_facts (total_output_sats);
CREATE INDEX block_facts_fee_idx ON public.block_facts (avg_fee_rate);

CREATE TABLE public.block_facts_crawl_state (
  id text PRIMARY KEY,
  next_height bigint NOT NULL DEFAULT 0,
  locked_until timestamptz NOT NULL DEFAULT 'epoch',
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.block_facts_crawl_state TO anon, authenticated;
GRANT ALL ON public.block_facts_crawl_state TO service_role;
ALTER TABLE public.block_facts_crawl_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crawl progress is public" ON public.block_facts_crawl_state FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.block_facts_crawl_state (id) VALUES ('main');

CREATE TABLE public.patoshi_blocks (block_height bigint PRIMARY KEY);
GRANT SELECT ON public.patoshi_blocks TO anon, authenticated;
GRANT ALL ON public.patoshi_blocks TO service_role;
ALTER TABLE public.patoshi_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patoshi list is public" ON public.patoshi_blocks FOR SELECT TO anon, authenticated USING (true);

-- Atomically claims the next crawl window; returns NULL when another run holds it.
CREATE OR REPLACE FUNCTION public.claim_block_facts_crawl(_lock_seconds integer)
RETURNS bigint LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.block_facts_crawl_state
     SET locked_until = now() + make_interval(secs => _lock_seconds), updated_at = now()
   WHERE id = 'main' AND locked_until < now()
  RETURNING next_height;
$$;
REVOKE ALL ON FUNCTION public.claim_block_facts_crawl(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_block_facts_crawl(integer) TO service_role;

-- True when a block-facts trait holds; NULL-safe (unknown facts never match).
CREATE OR REPLACE FUNCTION public.block_fact_trait(_height bigint, _trait text)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN _trait = 'patoshi' THEN EXISTS (SELECT 1 FROM patoshi_blocks p WHERE p.block_height = _height)
    WHEN _trait = 'chinese-lucky-number' THEN _height::text LIKE '%168%'
    ELSE COALESCE((SELECT CASE _trait
      WHEN 'leap-day' THEN to_char(f.mined_at AT TIME ZONE 'UTC', 'MM-DD') = '02-29'
      WHEN '21e8' THEN f.block_hash LIKE '%21e8%'
      WHEN 'pre-segwit-full' THEN f.block_height < 481824 AND f.size_bytes >= 999000
      WHEN 'miner-message' THEN f.coinbase_text IS NOT NULL
      WHEN 'billionaire' THEN f.total_output_sats * 30000 >= 100000000000000000
      WHEN 'mined-billionaire' THEN f.btc_usd IS NOT NULL AND f.total_output_sats::numeric * f.btc_usd >= 100000000000000000
      WHEN '100000-out' THEN f.total_output_sats > 10000000000000
      WHEN '250000-out' THEN f.total_output_sats > 25000000000000
      WHEN '500000-out' THEN f.total_output_sats > 50000000000000
      WHEN '1000000-out' THEN f.total_output_sats > 100000000000000
      WHEN '3000000-out' THEN f.total_output_sats > 300000000000000
      WHEN '5000000-out' THEN f.total_output_sats > 500000000000000
      WHEN '1k-fee-rate' THEN f.avg_fee_rate >= 1000 AND f.avg_fee_rate < 2000
      WHEN '2k-fee-rate' THEN f.avg_fee_rate >= 2000 AND f.avg_fee_rate < 3000
      WHEN '3k-fee-rate' THEN f.avg_fee_rate >= 3000 AND f.avg_fee_rate < 4000
      WHEN '4k-fee-rate' THEN f.avg_fee_rate >= 4000 AND f.avg_fee_rate < 5000
      WHEN '5k-fee-rate' THEN f.avg_fee_rate >= 5000 AND f.avg_fee_rate < 6000
      WHEN '6k-fee-rate' THEN f.avg_fee_rate >= 6000 AND f.avg_fee_rate < 7000
      WHEN '7k-fee-rate' THEN f.avg_fee_rate >= 7000
      ELSE false END
    FROM block_facts f WHERE f.block_height = _height), false)
  END;
$$;

CREATE OR REPLACE FUNCTION public.official_trait_bitmaps(p_trait text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24)
 RETURNS TABLE(block_height bigint, inscription_id text, owner_address text, genesis_height bigint, total_count bigint)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE _lo int; _hi int; _lim int := least(greatest(p_limit, 1), 121); _off int := greatest(p_offset, 0);
BEGIN
  IF p_trait IN ('1-tx','2-tx') OR p_trait ~ '^[1-8]k-txs$' THEN
    IF p_trait = '1-tx' THEN _lo := 1; _hi := 1;
    ELSIF p_trait = '2-tx' THEN _lo := 2; _hi := 2;
    ELSE _lo := substring(p_trait from '^([1-8])')::int * 1000;
         _hi := CASE WHEN _lo = 8000 THEN 2147483647 ELSE _lo + 999 END;
    END IF;
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.block_stats bs JOIN public.bitmap_index bi ON bi.block_height = bs.block_height
    WHERE bs.tx_count BETWEEN _lo AND _hi AND bi.is_valid AND bi.inscription_id IS NOT NULL
    ORDER BY bs.block_height OFFSET _off LIMIT _lim;
    RETURN;
  END IF;

  IF p_trait = 'patoshi' THEN
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.patoshi_blocks p JOIN public.bitmap_index bi ON bi.block_height = p.block_height
    WHERE bi.is_valid AND bi.inscription_id IS NOT NULL
    ORDER BY p.block_height OFFSET _off LIMIT _lim;
    RETURN;
  END IF;

  IF p_trait = 'chinese-lucky-number' THEN
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.bitmap_index bi
    WHERE bi.is_valid AND bi.inscription_id IS NOT NULL AND bi.block_height::text LIKE '%168%'
    ORDER BY bi.block_height OFFSET _off LIMIT _lim;
    RETURN;
  END IF;

  IF p_trait IN ('leap-day','21e8','pre-segwit-full','miner-message','billionaire','mined-billionaire',
                 '100000-out','250000-out','500000-out','1000000-out','3000000-out','5000000-out')
     OR p_trait ~ '^[1-7]k-fee-rate$' THEN
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.block_facts f JOIN public.bitmap_index bi ON bi.block_height = f.block_height
    WHERE bi.is_valid AND bi.inscription_id IS NOT NULL AND public.block_fact_trait(f.block_height, p_trait)
    ORDER BY f.block_height OFFSET _off LIMIT _lim;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint AS total_count
  FROM public.bitmap_index bi
  WHERE bi.is_valid = true AND bi.inscription_id IS NOT NULL
    AND CASE p_trait
      WHEN 'mythic' THEN bi.block_height = 0
      WHEN 'epic' THEN bi.block_height IN (210000, 420000, 630000, 840000, 1050000)
      WHEN 'rare' THEN bi.block_height > 0 AND mod(bi.block_height, 2016) = 0
      WHEN 'first-transaction' THEN bi.block_height = 170
      WHEN 'palindrome' THEN length(bi.block_height::text) >= 3 AND bi.block_height::text = reverse(bi.block_height::text)
      WHEN 'pizza-transaction' THEN bi.block_height = 57043
      WHEN 'pizza-day' THEN bi.block_height BETWEEN 56899 AND 57093
      WHEN 'block-9' THEN bi.block_height = 9
      WHEN 'block-78' THEN bi.block_height = 78
      WHEN '66-dao' THEN bi.block_height BETWEEN 660000 AND 669999
      WHEN 'same-digits' THEN length(bi.block_height::text) >= 3 AND bi.block_height::text ~ '^([0-9])\1+$'
      WHEN 'binary' THEN bi.block_height::text ~ '^[01]+$'
      WHEN 'power-of-10' THEN bi.block_height IN (1, 10, 100, 1000, 10000, 100000)
      WHEN 'sub-10' THEN bi.block_height >= 0 AND bi.block_height < 10
      WHEN 'sub-100' THEN bi.block_height >= 0 AND bi.block_height < 100
      WHEN 'sub-1k' THEN bi.block_height >= 0 AND bi.block_height < 1000
      WHEN 'sub-10k' THEN bi.block_height >= 0 AND bi.block_height < 10000
      WHEN 'sub-25k' THEN bi.block_height >= 0 AND bi.block_height < 25000
      WHEN 'sub-50k' THEN bi.block_height >= 0 AND bi.block_height < 50000
      WHEN 'sub-100k' THEN bi.block_height >= 0 AND bi.block_height < 100000
      WHEN 'fibonacci' THEN bi.block_height IN (1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368,75025,121393,196418,317811,514229,832040)
      WHEN 'prime-number' THEN bi.block_height >= 2 AND NOT EXISTS (
        SELECT 1 FROM generate_series(2, floor(sqrt(bi.block_height::numeric))::bigint) divisor
        WHERE mod(bi.block_height, divisor) = 0)
      ELSE false
    END
  ORDER BY bi.block_height ASC OFFSET _off LIMIT _lim;
END;
$function$;