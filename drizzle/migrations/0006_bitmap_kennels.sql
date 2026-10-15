CREATE TABLE public.bitmap_kennels (
  block_height bigint PRIMARY KEY,
  name text NOT NULL,
  holder_address text NOT NULL,
  payout_address text NOT NULL,
  holder_user uuid NOT NULL,
  price_sats integer NOT NULL,
  max_supply integer NOT NULL,
  minted_count integer NOT NULL DEFAULT 0,
  is_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmap_kennels TO anon, authenticated;
GRANT ALL ON public.bitmap_kennels TO service_role;
ALTER TABLE public.bitmap_kennels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kennels are public" ON public.bitmap_kennels FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.kennel_mints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_height bigint NOT NULL,
  child_index integer NOT NULL,
  inscription_id text NOT NULL UNIQUE,
  reveal_txid text NOT NULL,
  buyer_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_height, child_index)
);
GRANT SELECT ON public.kennel_mints TO anon, authenticated;
GRANT ALL ON public.kennel_mints TO service_role;
ALTER TABLE public.kennel_mints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kennel mints are public" ON public.kennel_mints FOR SELECT TO anon, authenticated USING (true);