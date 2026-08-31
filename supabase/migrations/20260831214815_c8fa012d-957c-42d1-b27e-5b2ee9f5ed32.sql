ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS offers_bid_id_idx ON public.offers (bid_id);

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS accepted_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_status_valid;
ALTER TABLE public.bids ADD CONSTRAINT bids_status_valid
  CHECK (status IN ('open','accepted','settled','cancelled','expired'));