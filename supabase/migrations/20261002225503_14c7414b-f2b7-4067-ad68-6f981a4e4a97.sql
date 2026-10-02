CREATE TABLE public.walker_raids (
  id text PRIMARY KEY,
  hp integer NOT NULL,
  max_hp integer NOT NULL,
  respawn_at timestamptz,
  last_killer text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.walker_raids TO anon, authenticated;
GRANT ALL ON public.walker_raids TO service_role;
ALTER TABLE public.walker_raids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view walkers" ON public.walker_raids FOR SELECT USING (true);

CREATE TABLE public.walker_raid_scores (
  user_id uuid PRIMARY KEY,
  name text NOT NULL,
  kills integer NOT NULL DEFAULT 0,
  damage bigint NOT NULL DEFAULT 0,
  last_hit_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.walker_raid_scores TO anon, authenticated;
GRANT ALL ON public.walker_raid_scores TO service_role;
ALTER TABLE public.walker_raid_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view walker scores" ON public.walker_raid_scores FOR SELECT USING (true);

INSERT INTO public.walker_raids (id, hp, max_hp) VALUES ('walker-a', 6000, 6000), ('walker-b', 6000, 6000);

CREATE OR REPLACE FUNCTION public.walker_hit(_walker text, _user uuid, _name text, _damage integer)
RETURNS TABLE(hp integer, max_hp integer, killed boolean, respawn_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.walker_raids; s public.walker_raid_scores; dmg integer; did_kill boolean := false;
BEGIN
  dmg := greatest(1, least(coalesce(_damage, 1), 80));
  SELECT * INTO w FROM public.walker_raids WHERE id = _walker FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'UNKNOWN WALKER'; END IF;
  IF w.respawn_at IS NOT NULL AND w.respawn_at <= now() THEN
    w.hp := w.max_hp; w.respawn_at := NULL;
  END IF;
  IF w.respawn_at IS NOT NULL THEN
    RETURN QUERY SELECT 0, w.max_hp, false, w.respawn_at; RETURN;
  END IF;
  SELECT * INTO s FROM public.walker_raid_scores WHERE user_id = _user;
  IF FOUND AND s.last_hit_at > now() - interval '300 milliseconds' THEN
    RETURN QUERY SELECT w.hp, w.max_hp, false, w.respawn_at; RETURN;
  END IF;
  w.hp := greatest(0, w.hp - dmg);
  IF w.hp = 0 THEN did_kill := true; w.respawn_at := now() + interval '3 minutes'; w.last_killer := _name; END IF;
  UPDATE public.walker_raids SET hp = w.hp, respawn_at = w.respawn_at, last_killer = w.last_killer, updated_at = now() WHERE id = _walker;
  INSERT INTO public.walker_raid_scores (user_id, name, kills, damage, last_hit_at)
  VALUES (_user, _name, CASE WHEN did_kill THEN 1 ELSE 0 END, dmg, now())
  ON CONFLICT (user_id) DO UPDATE SET name = excluded.name,
    kills = walker_raid_scores.kills + excluded.kills,
    damage = walker_raid_scores.damage + excluded.damage,
    last_hit_at = now(), updated_at = now();
  RETURN QUERY SELECT w.hp, w.max_hp, did_kill, w.respawn_at;
END $$;
REVOKE ALL ON FUNCTION public.walker_hit(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.walker_hit(text, uuid, text, integer) TO service_role;