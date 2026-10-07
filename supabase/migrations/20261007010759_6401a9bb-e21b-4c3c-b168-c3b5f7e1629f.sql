CREATE TABLE public.bitmap_spawn_points (
  bitmap_height bigint PRIMARY KEY,
  x numeric NOT NULL,
  z numeric NOT NULL,
  yaw numeric NOT NULL DEFAULT 0,
  owner_address text NOT NULL,
  set_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmap_spawn_points TO anon, authenticated;
GRANT ALL ON public.bitmap_spawn_points TO service_role;
ALTER TABLE public.bitmap_spawn_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spawn points are public" ON public.bitmap_spawn_points FOR SELECT TO anon, authenticated USING (true);