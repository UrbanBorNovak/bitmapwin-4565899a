CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitmap_height bigint NOT NULL,
  bidder_address text NOT NULL,
  price_sats bigint NOT NULL,
  expires_at timestamptz,
  note text,
  signature text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bids_height_range CHECK (bitmap_height >= 0 AND bitmap_height <= 1000000),
  CONSTRAINT bids_price_min CHECK (price_sats >= 546),
  CONSTRAINT bids_status_valid CHECK (status IN ('open','accepted','cancelled','expired')),
  CONSTRAINT bids_address_len CHECK (char_length(bidder_address) BETWEEN 14 AND 100),
  CONSTRAINT bids_note_len CHECK (note IS NULL OR char_length(note) <= 280)
);

GRANT SELECT, INSERT ON public.bids TO anon, authenticated;
GRANT ALL ON public.bids TO service_role;

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY bids_public_read ON public.bids FOR SELECT USING (true);
CREATE POLICY bids_public_insert ON public.bids FOR INSERT WITH CHECK (status = 'open');

CREATE INDEX bids_height_status_price_idx ON public.bids (bitmap_height, status, price_sats DESC);
CREATE INDEX bids_bidder_idx ON public.bids (bidder_address);

CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();