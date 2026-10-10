ALTER TABLE public.bitmap_forge_builds ADD COLUMN IF NOT EXISTS sat text;
CREATE INDEX IF NOT EXISTS bitmap_forge_builds_sat_idx ON public.bitmap_forge_builds (sat);