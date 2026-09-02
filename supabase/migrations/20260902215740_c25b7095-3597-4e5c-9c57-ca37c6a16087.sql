CREATE TABLE public.trade_crawl_state (
  block_height integer PRIMARY KEY,
  inscription_id text,
  transfers integer NOT NULL DEFAULT 0,
  trades_found integer NOT NULL DEFAULT 0,
  last_error text,
  last_traced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trade_crawl_state_last_traced_idx ON public.trade_crawl_state (last_traced_at);

GRANT SELECT ON public.trade_crawl_state TO anon;
GRANT SELECT ON public.trade_crawl_state TO authenticated;
GRANT ALL ON public.trade_crawl_state TO service_role;

ALTER TABLE public.trade_crawl_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY trade_crawl_state_public_read ON public.trade_crawl_state FOR SELECT USING (true);