CREATE TABLE public.guardian_raids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL UNIQUE REFERENCES public.guardian_dispatches(id) ON DELETE CASCADE,
  attacker_height bigint NOT NULL,
  defender_height bigint NOT NULL,
  winner_height bigint NOT NULL,
  spoils integer NOT NULL DEFAULT 0,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_raids_recent ON public.guardian_raids (resolved_at DESC);
GRANT SELECT ON public.guardian_raids TO anon, authenticated;
GRANT ALL ON public.guardian_raids TO service_role;
ALTER TABLE public.guardian_raids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Raid results are public" ON public.guardian_raids FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.bitmap_spoils (
  block_height bigint PRIMARY KEY,
  bit bigint NOT NULL DEFAULT 0,
  raids_won integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bitmap_spoils TO anon, authenticated;
GRANT ALL ON public.bitmap_spoils TO service_role;
ALTER TABLE public.bitmap_spoils ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Land spoils are public" ON public.bitmap_spoils FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.land_raid_spoils(_height bigint, _bit integer)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.bitmap_spoils (block_height, bit, raids_won) VALUES (_height, _bit, 1)
  ON CONFLICT (block_height) DO UPDATE SET bit = bitmap_spoils.bit + EXCLUDED.bit, raids_won = bitmap_spoils.raids_won + 1, updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.land_raid_spoils(bigint, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.land_raid_spoils(bigint, integer) TO service_role;