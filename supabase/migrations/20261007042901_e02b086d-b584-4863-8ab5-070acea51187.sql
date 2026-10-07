CREATE TABLE public.player_friend_codes (
  user_id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  handle text NOT NULL DEFAULT 'PLAYER',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.player_friends (
  a uuid NOT NULL,
  b uuid NOT NULL,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
CREATE TABLE public.bitmap_crews (
  height bigint NOT NULL,
  user_id uuid NOT NULL,
  added_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (height, user_id)
);
CREATE INDEX bitmap_crews_user ON public.bitmap_crews (user_id);
CREATE TABLE public.crew_stash (
  height bigint NOT NULL,
  kind text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 9999),
  PRIMARY KEY (height, kind)
);

GRANT ALL ON public.player_friend_codes, public.player_friends, public.bitmap_crews, public.crew_stash TO service_role;
REVOKE ALL ON public.player_friend_codes, public.player_friends, public.bitmap_crews, public.crew_stash FROM anon, authenticated;
ALTER TABLE public.player_friend_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bitmap_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_stash ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access" ON public.player_friend_codes FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No browser access" ON public.player_friends FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No browser access" ON public.bitmap_crews FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No browser access" ON public.crew_stash FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Move blocks between a crew member's bag and the BITMAP's shared stash.
-- _n > 0 deposits from the bag, _n < 0 withdraws into the bag.
CREATE OR REPLACE FUNCTION public.crew_move(_user uuid, _height bigint, _kind text, _n integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE have int;
BEGIN
  IF _n = 0 OR abs(_n) > 999 THEN RETURN 'BAD AMOUNT'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bitmap_crews WHERE height=_height AND user_id=_user) THEN RETURN 'NOT IN THIS CREW'; END IF;
  INSERT INTO crew_stash(height, kind, count) VALUES (_height, _kind, 0) ON CONFLICT DO NOTHING;
  SELECT count INTO have FROM crew_stash WHERE height=_height AND kind=_kind FOR UPDATE;
  IF _n > 0 THEN
    IF have + _n > 9999 THEN RETURN 'STASH FULL'; END IF;
    IF NOT voxel_bag_add(_user, _kind, -_n) THEN RETURN 'NOT ENOUGH ' || upper(_kind) || ' IN YOUR BAG'; END IF;
    UPDATE crew_stash SET count = count + _n WHERE height=_height AND kind=_kind;
  ELSE
    IF have < -_n THEN RETURN 'NOT ENOUGH ' || upper(_kind) || ' IN THE STASH'; END IF;
    IF NOT voxel_bag_add(_user, _kind, -_n) THEN RETURN 'BAG FULL'; END IF;
    UPDATE crew_stash SET count = count + _n WHERE height=_height AND kind=_kind;
  END IF;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.crew_move(uuid,bigint,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crew_move(uuid,bigint,text,integer) TO service_role;