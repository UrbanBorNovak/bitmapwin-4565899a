CREATE TABLE public.puzzle_pool_slices (
  slice_index bigint PRIMARY KEY,
  worker text NOT NULL,
  lease_token text NOT NULL,
  leased_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  best_offset bigint,
  best_hash text
);
CREATE INDEX puzzle_pool_slices_worker_idx ON public.puzzle_pool_slices (worker, done_at);
REVOKE ALL ON public.puzzle_pool_slices FROM anon, authenticated;
GRANT ALL ON public.puzzle_pool_slices TO service_role;
ALTER TABLE public.puzzle_pool_slices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all browser access" ON public.puzzle_pool_slices FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);