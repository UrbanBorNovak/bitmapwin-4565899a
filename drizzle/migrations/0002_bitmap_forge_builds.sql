CREATE TABLE public.bitmap_forge_builds (
  bitmap_height bigint PRIMARY KEY,
  inscription_id text NOT NULL,
  archetype text,
  block_count integer NOT NULL DEFAULT 0,
  verified_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmap_forge_builds TO anon, authenticated;
GRANT ALL ON public.bitmap_forge_builds TO service_role;
ALTER TABLE public.bitmap_forge_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verified forge builds are public" ON public.bitmap_forge_builds FOR SELECT TO anon, authenticated USING (true);