CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  psbt_base64 text NOT NULL,
  psbt_hash text NOT NULL UNIQUE,
  bitmap_height bigint,
  inscription_id text,
  outpoint text NOT NULL,
  seller_address text,
  price_sats bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX offers_bitmap_height_idx ON public.offers (bitmap_height);
CREATE INDEX offers_status_idx ON public.offers (status);
CREATE INDEX offers_created_at_idx ON public.offers (created_at DESC);

GRANT SELECT, INSERT ON public.offers TO anon;
GRANT SELECT, INSERT ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY offers_public_read ON public.offers FOR SELECT USING (true);
CREATE POLICY offers_public_insert ON public.offers FOR INSERT WITH CHECK (true);

CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON public.offers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();