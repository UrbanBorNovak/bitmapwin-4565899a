ALTER PUBLICATION supabase_realtime DROP TABLE public.oasis_voxels;
REVOKE SELECT ON public.oasis_voxels FROM anon, authenticated;
GRANT SELECT (x, y, z, kind, updated_at) ON public.oasis_voxels TO anon, authenticated;