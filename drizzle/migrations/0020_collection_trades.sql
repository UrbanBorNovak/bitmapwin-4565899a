CREATE TABLE public.collection_trades (
  txid text PRIMARY KEY,
  collection text NOT NULL,
  inscription_id text NOT NULL,
  seller_address text,
  buyer_address text,
  price_sats bigint NOT NULL,
  block_height bigint,
  block_time timestamptz,
  source text NOT NULL DEFAULT 'EXTERNAL',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collection_trades_collection_idx ON public.collection_trades(collection);
GRANT SELECT ON public.collection_trades TO anon, authenticated;
GRANT ALL ON public.collection_trades TO service_role;
ALTER TABLE public.collection_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection trades are public chain facts" ON public.collection_trades FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.collection_trace_state (
  inscription_id text PRIMARY KEY,
  collection text NOT NULL,
  last_traced_at timestamptz NOT NULL DEFAULT now(),
  verified boolean NOT NULL DEFAULT false
);
CREATE INDEX collection_trace_state_coll_idx ON public.collection_trace_state(collection, last_traced_at);
GRANT ALL ON public.collection_trace_state TO service_role;
REVOKE ALL ON public.collection_trace_state FROM anon, authenticated;
ALTER TABLE public.collection_trace_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.collection_trace_state FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);