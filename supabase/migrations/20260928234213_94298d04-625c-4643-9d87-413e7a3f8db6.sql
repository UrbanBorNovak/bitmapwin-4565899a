CREATE TABLE public.shord_pool_withdrawals (
  nullifier text PRIMARY KEY,
  inscription_id text NOT NULL,
  destination text NOT NULL,
  txid text,
  fee_sats integer,
  status text NOT NULL DEFAULT 'signing',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.shord_pool_withdrawals TO service_role;
ALTER TABLE public.shord_pool_withdrawals ENABLE ROW LEVEL SECURITY;