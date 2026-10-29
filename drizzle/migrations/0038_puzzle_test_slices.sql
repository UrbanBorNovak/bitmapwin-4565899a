CREATE TABLE public.puzzle_test_slices (
  slice_index bigint PRIMARY KEY,
  worker text NOT NULL,
  lease_token text NOT NULL,
  leased_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  best_offset bigint,
  best_hash text
);
REVOKE ALL ON public.puzzle_test_slices FROM anon, authenticated;
GRANT ALL ON public.puzzle_test_slices TO service_role;
ALTER TABLE public.puzzle_test_slices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all browser access" ON public.puzzle_test_slices FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);