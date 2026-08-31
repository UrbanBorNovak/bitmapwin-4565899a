CREATE TABLE public.trades (
  txid text PRIMARY KEY,
  bitmap_height bigint NOT NULL,
  inscription_id text,
  seller_address text,
  buyer_address text,
  price_sats bigint NOT NULL DEFAULT 0,
  block_height bigint,
  block_time timestamp with time zone,
  hop integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.trades TO anon;
GRANT SELECT, INSERT, UPDATE ON public.trades TO authenticated;
GRANT ALL ON public.trades TO service_role;

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY trades_public_read ON public.trades FOR SELECT USING (true);
CREATE POLICY trades_public_insert ON public.trades FOR INSERT WITH CHECK (true);
CREATE POLICY trades_public_update ON public.trades FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX trades_bitmap_height_idx ON public.trades (bitmap_height);
CREATE INDEX trades_block_height_idx ON public.trades (block_height DESC);

CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DELETE FROM public.activity;
DELETE FROM public.listings;
DELETE FROM public.bitmaps;