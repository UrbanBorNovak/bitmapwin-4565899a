CREATE TABLE public.forge_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  sphere text NOT NULL DEFAULT 'community',
  author_user uuid NOT NULL,
  author_address text NOT NULL,
  blocks jsonb NOT NULL,
  block_count integer NOT NULL,
  bit_cost integer NOT NULL DEFAULT 0 CHECK (bit_cost BETWEEN 0 AND 500),
  tribute_sats integer NOT NULL DEFAULT 0 CHECK (tribute_sats = 0 OR tribute_sats BETWEEN 546 AND 100000),
  lineage jsonb NOT NULL DEFAULT '[]'::jsonb,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forge_modules TO anon, authenticated;
GRANT ALL ON public.forge_modules TO service_role;
ALTER TABLE public.forge_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forge modules are public" ON public.forge_modules FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX forge_modules_recent ON public.forge_modules (created_at DESC);