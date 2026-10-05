CREATE TABLE public.bitmap_custody (
  block_height bigint PRIMARY KEY,
  inscription_id text NOT NULL,
  satpoint text,
  last_move_block bigint,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmap_custody TO anon, authenticated;
GRANT ALL ON public.bitmap_custody TO service_role;
ALTER TABLE public.bitmap_custody ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Custody facts are public" ON public.bitmap_custody FOR SELECT USING (true);