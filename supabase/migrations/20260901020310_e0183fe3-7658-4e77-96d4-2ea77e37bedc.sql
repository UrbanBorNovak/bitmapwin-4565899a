CREATE TABLE public.block_stats (
  block_height bigint PRIMARY KEY,
  tx_count integer NOT NULL,
  preview_width integer NOT NULL,
  preview_height integer NOT NULL,
  pattern integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.block_stats TO anon;
GRANT SELECT ON public.block_stats TO authenticated;
GRANT ALL ON public.block_stats TO service_role;

ALTER TABLE public.block_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block stats are public chain data"
  ON public.block_stats FOR SELECT
  USING (true);

CREATE INDEX block_stats_pattern_idx ON public.block_stats (pattern);
CREATE INDEX block_stats_tx_count_idx ON public.block_stats (tx_count DESC);