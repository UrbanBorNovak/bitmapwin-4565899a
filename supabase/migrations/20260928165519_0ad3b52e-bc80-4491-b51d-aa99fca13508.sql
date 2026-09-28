CREATE TABLE public.bitmon_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_height bigint NOT NULL UNIQUE,
  species text NOT NULL,
  rarity text NOT NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  dna_hash text NOT NULL,
  summoned_by_address text NOT NULL,
  summoned_by_user_id uuid,
  payment_txid text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmon_guardians TO anon, authenticated;
GRANT ALL ON public.bitmon_guardians TO service_role;
ALTER TABLE public.bitmon_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guardians are public" ON public.bitmon_guardians FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bitmon_summon_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  block_height bigint NOT NULL,
  payer_address text NOT NULL,
  amount_sats bigint NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  txid text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitmon_orders_user_idx ON public.bitmon_summon_orders(user_id, created_at DESC);
GRANT SELECT ON public.bitmon_summon_orders TO authenticated;
GRANT ALL ON public.bitmon_summon_orders TO service_role;
ALTER TABLE public.bitmon_summon_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own summon orders" ON public.bitmon_summon_orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER bitmon_orders_touch BEFORE UPDATE ON public.bitmon_summon_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();