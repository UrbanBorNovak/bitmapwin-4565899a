CREATE TABLE public.adrenaline_licenses (
  user_id uuid PRIMARY KEY,
  address text NOT NULL,
  price_bit integer NOT NULL,
  licensed_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.adrenaline_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no browser access" ON public.adrenaline_licenses FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.adrenaline_licenses FROM anon, authenticated;
GRANT ALL ON public.adrenaline_licenses TO service_role;

-- Offline farm: pays block-bag materials (never BIT) for time away, capped at 12h.
CREATE OR REPLACE FUNCTION public.adrenaline_claim(_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lic record; hrs numeric; units int; got jsonb := '{}'::jsonb; k text; n int;
BEGIN
  SELECT * INTO lic FROM adrenaline_licenses WHERE user_id = _user FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NO LICENCE'); END IF;
  hrs := LEAST(12, EXTRACT(EPOCH FROM (now() - lic.last_seen_at)) / 3600.0);
  units := floor(hrs * 4)::int; -- one farm tick per 15 minutes away
  UPDATE adrenaline_licenses SET last_seen_at = now() WHERE user_id = _user;
  IF units < 1 THEN RETURN jsonb_build_object('ok', true, 'hours', round(hrs, 2), 'loot', got, 'kills', 0); END IF;
  PERFORM voxel_bag_ensure(_user);
  FOREACH k IN ARRAY ARRAY['dirt','cobble','log','sand'] LOOP
    n := CASE k WHEN 'dirt' THEN units * 2 WHEN 'cobble' THEN units WHEN 'log' THEN units / 2 ELSE units END;
    IF n > 0 THEN
      PERFORM voxel_bag_add(_user, k, LEAST(n, 200));
      got := got || jsonb_build_object(k, LEAST(n, 200));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'hours', round(hrs, 2), 'loot', got, 'kills', units);
END $$;
REVOKE ALL ON FUNCTION public.adrenaline_claim(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adrenaline_claim(uuid) TO service_role;