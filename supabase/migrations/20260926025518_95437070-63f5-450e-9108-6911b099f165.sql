CREATE TABLE public.collection_sales (
  txid text PRIMARY KEY,
  collection text NOT NULL,
  inscription_id text NOT NULL,
  seller_address text,
  buyer_address text,
  price_sats bigint NOT NULL DEFAULT 0,
  block_height integer,
  block_time timestamptz,
  hop integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collection_sales_collection_idx ON public.collection_sales (collection, block_height DESC);
GRANT SELECT ON public.collection_sales TO anon, authenticated;
GRANT ALL ON public.collection_sales TO service_role;
ALTER TABLE public.collection_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collection sales" ON public.collection_sales FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.collection_crawl_state (
  inscription_id text PRIMARY KEY,
  collection text NOT NULL,
  owner_address text,
  transfers integer NOT NULL DEFAULT 0,
  last_traced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.collection_crawl_state TO anon, authenticated;
GRANT ALL ON public.collection_crawl_state TO service_role;
ALTER TABLE public.collection_crawl_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read collection crawl state" ON public.collection_crawl_state FOR SELECT TO anon, authenticated USING (true);