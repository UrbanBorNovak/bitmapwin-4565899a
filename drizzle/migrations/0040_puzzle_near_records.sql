CREATE TABLE public.puzzle_near_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nibbles int NOT NULL,
  hash text NOT NULL UNIQUE,
  found_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.puzzle_near_records TO anon, authenticated;
GRANT ALL ON public.puzzle_near_records TO service_role;
ALTER TABLE public.puzzle_near_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read near records" ON public.puzzle_near_records FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX ON public.puzzle_near_records (nibbles DESC, found_at);