CREATE TABLE public.voxel_bags (
  user_id uuid NOT NULL,
  kind text NOT NULL,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 999),
  PRIMARY KEY (user_id, kind)
);
CREATE TABLE public.voxel_bag_meta (
  user_id uuid PRIMARY KEY,
  last_harvest_at timestamptz NOT NULL DEFAULT 'epoch'
);
REVOKE ALL ON public.voxel_bags, public.voxel_bag_meta FROM anon, authenticated;
GRANT ALL ON public.voxel_bags, public.voxel_bag_meta TO service_role;
ALTER TABLE public.voxel_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voxel_bag_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access to block bags" ON public.voxel_bags FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No browser access to block bag meta" ON public.voxel_bag_meta FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.voxel_bag_ensure(_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO voxel_bag_meta(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  IF FOUND THEN
    INSERT INTO voxel_bags(user_id, kind, count) VALUES
      (_user,'planks',24),(_user,'log',8),(_user,'cobble',16)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.voxel_bag_add(_user uuid, _kind text, _n integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  INSERT INTO voxel_bags(user_id, kind, count) VALUES (_user, _kind, 0) ON CONFLICT DO NOTHING;
  SELECT count INTO c FROM voxel_bags WHERE user_id=_user AND kind=_kind FOR UPDATE;
  IF c + _n < 0 OR c + _n > 999 THEN RETURN false; END IF;
  UPDATE voxel_bags SET count = c + _n WHERE user_id=_user AND kind=_kind;
  RETURN true;
END $$;

-- Place (kind) or break ("air") one block, paying from / refunding to the bag.
CREATE OR REPLACE FUNCTION public.voxel_edit(_user uuid, _x int, _y int, _z int, _kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cur text;
BEGIN
  PERFORM voxel_bag_ensure(_user);
  SELECT kind INTO cur FROM oasis_voxels WHERE x=_x AND y=_y AND z=_z FOR UPDATE;
  IF _kind = 'air' THEN
    IF cur IS NULL OR cur = 'air' THEN RETURN 'NOTHING TO BREAK'; END IF;
    IF NOT voxel_bag_add(_user, cur, 1) THEN RETURN 'BAG FULL FOR ' || upper(cur); END IF;
    DELETE FROM oasis_voxels WHERE x=_x AND y=_y AND z=_z;
    RETURN 'ok';
  END IF;
  IF cur IS NOT NULL AND cur <> 'air' THEN RETURN 'SPACE TAKEN'; END IF;
  IF NOT voxel_bag_add(_user, _kind, -1) THEN RETURN 'NO ' || upper(_kind) || ' LEFT — GATHER OR CRAFT MORE'; END IF;
  INSERT INTO oasis_voxels(x,y,z,kind,placed_by,updated_at) VALUES (_x,_y,_z,_kind,_user,now())
  ON CONFLICT (x,y,z) DO UPDATE SET kind=EXCLUDED.kind, placed_by=EXCLUDED.placed_by, updated_at=now();
  RETURN 'ok';
END $$;

-- Gather one raw block from natural ground (cooldown 700ms).
CREATE OR REPLACE FUNCTION public.voxel_harvest(_user uuid, _kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last timestamptz;
BEGIN
  IF _kind NOT IN ('grass','dirt','sand','cobble') THEN RETURN 'CANNOT GATHER THAT'; END IF;
  PERFORM voxel_bag_ensure(_user);
  SELECT last_harvest_at INTO last FROM voxel_bag_meta WHERE user_id=_user FOR UPDATE;
  IF last > now() - interval '700 milliseconds' THEN RETURN 'TOO FAST'; END IF;
  IF NOT voxel_bag_add(_user, _kind, 1) THEN RETURN 'BAG FULL'; END IF;
  UPDATE voxel_bag_meta SET last_harvest_at = now() WHERE user_id=_user;
  RETURN 'ok';
END $$;

-- Fixed recipes: output <- inputs.
CREATE OR REPLACE FUNCTION public.voxel_craft(_user uuid, _out text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; k text; n int; qty int := 1;
BEGIN
  r := CASE _out
    WHEN 'log' THEN '{"dirt":3}'::jsonb
    WHEN 'planks' THEN '{"log":1}'::jsonb
    WHEN 'stone' THEN '{"cobble":2}'::jsonb
    WHEN 'brick' THEN '{"stone":1,"dirt":1}'::jsonb
    WHEN 'glass' THEN '{"sand":2}'::jsonb
    WHEN 'gold' THEN '{"stone":4,"sand":4}'::jsonb
    WHEN 'glow' THEN '{"glass":1,"gold":1}'::jsonb
    ELSE NULL END;
  IF r IS NULL THEN RETURN 'NO RECIPE'; END IF;
  IF _out = 'planks' THEN qty := 4; END IF;
  PERFORM voxel_bag_ensure(_user);
  FOR k, n IN SELECT key, value::int FROM jsonb_each_text(r) LOOP
    IF NOT voxel_bag_add(_user, k, -n) THEN RAISE EXCEPTION 'missing %', k; END IF;
  END LOOP;
  IF NOT voxel_bag_add(_user, _out, qty) THEN RAISE EXCEPTION 'bag full'; END IF;
  RETURN 'ok';
EXCEPTION WHEN raise_exception THEN
  RETURN 'NOT ENOUGH MATERIALS';
END $$;

REVOKE ALL ON FUNCTION public.voxel_bag_ensure(uuid), public.voxel_bag_add(uuid,text,integer),
  public.voxel_edit(uuid,int,int,int,text), public.voxel_harvest(uuid,text), public.voxel_craft(uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_bag_ensure(uuid), public.voxel_bag_add(uuid,text,integer),
  public.voxel_edit(uuid,int,int,int,text), public.voxel_harvest(uuid,text), public.voxel_craft(uuid,text)
  TO service_role;