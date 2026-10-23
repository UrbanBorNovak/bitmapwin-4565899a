CREATE TABLE public.launch_seat_wear (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('hat','food')),
  item text NOT NULL,
  price_bit integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (address, item)
);
CREATE INDEX launch_seat_wear_address_idx ON public.launch_seat_wear (address, created_at DESC);
GRANT SELECT (address, slot, item, created_at) ON public.launch_seat_wear TO anon, authenticated;
GRANT ALL ON public.launch_seat_wear TO service_role;
ALTER TABLE public.launch_seat_wear ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wardrobe is public to view" ON public.launch_seat_wear FOR SELECT TO anon, authenticated USING (true);