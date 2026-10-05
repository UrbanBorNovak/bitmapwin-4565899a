CREATE TABLE public.genesis_minters (
  inscription_id TEXT PRIMARY KEY,
  block_height BIGINT NOT NULL,
  minter_address TEXT NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.genesis_minters TO anon, authenticated;
GRANT ALL ON public.genesis_minters TO service_role;
ALTER TABLE public.genesis_minters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Genesis minters are public" ON public.genesis_minters FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX genesis_minters_minter_idx ON public.genesis_minters (minter_address);