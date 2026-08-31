ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS buyer_psbt_base64 text,
  ADD COLUMN IF NOT EXISTS buyer_txid text;