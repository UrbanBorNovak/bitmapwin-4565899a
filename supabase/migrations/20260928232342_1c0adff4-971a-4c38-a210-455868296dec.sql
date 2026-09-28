CREATE TABLE public.shord_pool_leaves (
  idx integer PRIMARY KEY,
  commitment text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('deposit','transfer')),
  inscription_id text,
  deposit_txid text,
  root_after text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shord_pool_leaves TO anon, authenticated;
GRANT ALL ON public.shord_pool_leaves TO service_role;
ALTER TABLE public.shord_pool_leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pool leaves are public" ON public.shord_pool_leaves FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.shord_pool_nullifiers (
  nullifier text PRIMARY KEY,
  root text NOT NULL,
  out_commitment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.shord_pool_nullifiers TO anon, authenticated;
GRANT ALL ON public.shord_pool_nullifiers TO service_role;
ALTER TABLE public.shord_pool_nullifiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Spent nullifiers are public" ON public.shord_pool_nullifiers FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.shord_pool_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id text NOT NULL,
  commitment text NOT NULL UNIQUE,
  holder_address text NOT NULL,
  signature text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting','shielded')),
  deposit_txid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX shord_deposit_one_awaiting ON public.shord_pool_deposits(inscription_id) WHERE status = 'awaiting';
GRANT ALL ON public.shord_pool_deposits TO service_role;
ALTER TABLE public.shord_pool_deposits ENABLE ROW LEVEL SECURITY;