CREATE OR REPLACE FUNCTION public.atlas_region_stats(p_lo bigint, p_hi bigint)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH rows AS (
    SELECT owner_address, is_valid
    FROM public.bitmap_index
    WHERE block_height >= p_lo AND block_height <= p_hi
      AND inscription_id IS NOT NULL
  ), grouped AS (
    SELECT owner_address, count(*)::int AS held
    FROM rows
    WHERE owner_address IS NOT NULL
    GROUP BY owner_address
    ORDER BY held DESC
    LIMIT 8
  )
  SELECT json_build_object(
    'indexed', (SELECT count(*)::int FROM rows),
    'valid', (SELECT count(*)::int FROM rows WHERE is_valid),
    'owners', (SELECT count(DISTINCT owner_address)::int FROM rows WHERE owner_address IS NOT NULL),
    'unowned', (SELECT count(*)::int FROM rows WHERE owner_address IS NULL),
    'top', COALESCE((SELECT json_agg(json_build_object('address', owner_address, 'held', held)) FROM grouped), '[]'::json)
  )
$$;

REVOKE ALL ON FUNCTION public.atlas_region_stats(bigint, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_region_stats(bigint, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_region_stats(bigint, bigint) TO service_role;