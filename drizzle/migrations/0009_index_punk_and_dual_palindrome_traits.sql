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

  IF p_trait IN ('5tx-perfect-punk','7tx-perfect-punk') THEN
    _lo := substring(p_trait from '^([0-9]+)')::int;
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.block_stats bs JOIN public.bitmap_index bi ON bi.block_height = bs.block_height
    WHERE bs.tx_count = _lo AND bi.is_valid AND bi.inscription_id IS NOT NULL
    ORDER BY bs.block_height OFFSET _off LIMIT _lim;
    RETURN;
  END IF;

  IF p_trait = 'dual-palindrome' THEN
    RETURN QUERY
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height, (-1)::bigint
    FROM public.bitmap_index bi
    WHERE bi.is_valid AND bi.inscription_id IS NOT NULL AND bi.sat IS NOT NULL
      AND length(bi.block_height::text) >= 3 AND bi.block_height::text = reverse(bi.block_height::text)
      AND length(bi.sat::text) >= 3 AND bi.sat::text = reverse(bi.sat::text)
    ORDER BY bi.block_height OFFSET _off LIMIT _lim;
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