ALTER TABLE public.shord_pool_nullifiers
  ADD COLUMN IF NOT EXISTS relay_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS relay_txid text,
  ADD COLUMN IF NOT EXISTS relay_fee_sats integer,
  ADD COLUMN IF NOT EXISTS relay_error text,
  ADD COLUMN IF NOT EXISTS envelope_hex text;
CREATE INDEX IF NOT EXISTS shord_pool_nullifiers_relay_idx ON public.shord_pool_nullifiers (relay_status);