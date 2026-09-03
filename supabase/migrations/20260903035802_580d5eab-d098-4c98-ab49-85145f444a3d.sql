CREATE OR REPLACE FUNCTION public.map_bitmap_models(
  _row_from bigint,
  _row_to bigint,
  _col_from bigint,
  _col_to bigint
)
RETURNS TABLE(
  bitmap_height bigint,
  owner_address text,
  inscription_id text,
  scale numeric,
  rotation_y numeric,
  height_offset numeric,
  triangle_count integer,
  animation_count integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    m.bitmap_height,
    m.owner_address,
    m.inscription_id,
    m.scale,
    m.rotation_y,
    m.height_offset,
    m.triangle_count,
    m.animation_count
  FROM public.bitmap_models m
  WHERE m.validation_status = 'approved'
    AND floor(m.bitmap_height / 1000) BETWEEN greatest(0, _row_from) AND least(999, _row_to)
    AND mod(m.bitmap_height, 1000) BETWEEN greatest(0, _col_from) AND least(999, _col_to)
  ORDER BY m.updated_at DESC
  LIMIT 24
$$;

GRANT EXECUTE ON FUNCTION public.map_bitmap_models(bigint, bigint, bigint, bigint) TO anon, authenticated, service_role;