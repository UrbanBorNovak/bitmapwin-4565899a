CREATE TABLE public.oasis_voxels (
  x integer NOT NULL,
  y integer NOT NULL,
  z integer NOT NULL,
  kind text NOT NULL,
  placed_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (x, y, z)
);
CREATE INDEX oasis_voxels_xz ON public.oasis_voxels (x, z);
CREATE INDEX oasis_voxels_user_time ON public.oasis_voxels (placed_by, updated_at DESC);
GRANT SELECT ON public.oasis_voxels TO anon, authenticated;
GRANT ALL ON public.oasis_voxels TO service_role;
ALTER TABLE public.oasis_voxels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see the shared voxel world" ON public.oasis_voxels FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.oasis_voxels;