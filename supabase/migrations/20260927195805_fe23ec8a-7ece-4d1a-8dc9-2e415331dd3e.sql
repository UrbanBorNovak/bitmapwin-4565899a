CREATE OR REPLACE FUNCTION public.official_trait_bitmaps(
  p_trait text,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 24
)
RETURNS TABLE(
  block_height bigint,
  inscription_id text,
  owner_address text,
  genesis_height bigint,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH matched AS (
    SELECT bi.block_height, bi.inscription_id, bi.owner_address, bi.genesis_height
    FROM public.bitmap_index bi
    WHERE bi.is_valid = true
      AND bi.inscription_id IS NOT NULL
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
        WHEN 'power-of-10' THEN bi.block_height IN (1, 10, 100, 1000, 10000, 100000, 1000000)
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
          WHERE mod(bi.block_height, divisor) = 0
        )
        ELSE false
      END
  )
  SELECT m.block_height, m.inscription_id, m.owner_address, m.genesis_height,
         count(*) OVER () AS total_count
  FROM matched m
  ORDER BY m.block_height ASC
  OFFSET greatest(p_offset, 0)
  LIMIT least(greatest(p_limit, 1), 120);
$$;

GRANT EXECUTE ON FUNCTION public.official_trait_bitmaps(text, integer, integer) TO anon, authenticated, service_role;