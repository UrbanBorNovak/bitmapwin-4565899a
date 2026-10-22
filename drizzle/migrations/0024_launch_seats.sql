CREATE TABLE public.launch_seats (
  seat_number integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  address text NOT NULL UNIQUE,
  pixel_id text NOT NULL,
  pixel_source text NOT NULL DEFAULT 'assigned',
  held_bitmap integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.launch_seats TO anon, authenticated;
GRANT ALL ON public.launch_seats TO service_role;
ALTER TABLE public.launch_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Launch seats are public" ON public.launch_seats FOR SELECT TO anon, authenticated USING (true);