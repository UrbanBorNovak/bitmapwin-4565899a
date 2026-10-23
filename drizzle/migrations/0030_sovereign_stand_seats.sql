CREATE TABLE public.stand_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id text NOT NULL CHECK (stand_id ~ '^[0-9a-f]{64}i[0-9]+$'),
  seat_number integer NOT NULL,
  address text NOT NULL,
  held_bitmap integer NOT NULL,
  issued_at text NOT NULL,
  signature text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stand_id, seat_number)
);
CREATE UNIQUE INDEX stand_seats_stand_address ON public.stand_seats (stand_id, lower(address));
CREATE INDEX stand_seats_address ON public.stand_seats (lower(address));

CREATE OR REPLACE FUNCTION public.stand_seats_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.stand_id));
  SELECT coalesce(max(seat_number), 0) + 1 INTO NEW.seat_number FROM public.stand_seats WHERE stand_id = NEW.stand_id;
  RETURN NEW;
END $$;
CREATE TRIGGER stand_seats_number BEFORE INSERT ON public.stand_seats FOR EACH ROW EXECUTE FUNCTION public.stand_seats_number();

GRANT SELECT ON public.stand_seats TO anon, authenticated;
GRANT ALL ON public.stand_seats TO service_role;
ALTER TABLE public.stand_seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stand seats are public proof" ON public.stand_seats FOR SELECT TO anon, authenticated USING (true);