ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS buyer_address text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_note text;

CREATE INDEX IF NOT EXISTS offers_buyer_address_idx ON public.offers (buyer_address);
CREATE INDEX IF NOT EXISTS offers_seller_address_idx ON public.offers (seller_address);