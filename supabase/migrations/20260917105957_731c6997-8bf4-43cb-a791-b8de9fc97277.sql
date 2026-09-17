GRANT SELECT ON TABLE public.world_structures TO anon, authenticated;
GRANT ALL ON TABLE public.world_structures TO service_role;

DROP POLICY IF EXISTS bitmap_index_public_insert ON public.bitmap_index;
DROP POLICY IF EXISTS bitmap_index_public_update ON public.bitmap_index;
REVOKE INSERT, UPDATE ON TABLE public.bitmap_index FROM anon, authenticated;
GRANT SELECT ON TABLE public.bitmap_index TO anon, authenticated;
GRANT ALL ON TABLE public.bitmap_index TO service_role;