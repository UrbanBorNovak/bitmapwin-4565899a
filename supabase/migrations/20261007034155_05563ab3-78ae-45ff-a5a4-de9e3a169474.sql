CREATE TABLE public.voxel_tools (
  user_id uuid NOT NULL,
  tool text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tool)
);
REVOKE ALL ON public.voxel_tools FROM anon, authenticated;
GRANT ALL ON public.voxel_tools TO service_role;
ALTER TABLE public.voxel_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No browser access to block tools" ON public.voxel_tools FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.voxel_pay(_user uuid, _cost jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; n int;
BEGIN
  FOR k, n IN SELECT key, value::int FROM jsonb_each_text(_cost) LOOP
    IF NOT voxel_bag_add(_user, k, -n) THEN RAISE EXCEPTION 'missing %', k; END IF;
  END LOOP;
  RETURN true;
END $$;

-- Forge a pickaxe.
CREATE OR REPLACE FUNCTION public.voxel_forge(_user uuid, _tool text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c jsonb;
BEGIN
  c := CASE _tool
    WHEN 'wood_pickaxe' THEN '{"planks":6,"log":2}'::jsonb
    WHEN 'stone_pickaxe' THEN '{"cobble":8,"log":2}'::jsonb
    WHEN 'gold_pickaxe' THEN '{"gold":4,"stone":4,"log":2}'::jsonb
    WHEN 'glow_pickaxe' THEN '{"glow":2,"gold":4,"log":2}'::jsonb
    ELSE NULL END;
  IF c IS NULL THEN RETURN 'NO SUCH TOOL'; END IF;
  PERFORM voxel_bag_ensure(_user);
  IF EXISTS (SELECT 1 FROM voxel_tools WHERE user_id=_user AND tool=_tool) THEN RETURN 'ALREADY FORGED'; END IF;
  PERFORM voxel_pay(_user, c);
  INSERT INTO voxel_tools(user_id, tool) VALUES (_user, _tool);
  RETURN 'ok';
EXCEPTION WHEN raise_exception THEN RETURN 'NOT ENOUGH MATERIALS';
END $$;

-- Fixed forge trades.
CREATE OR REPLACE FUNCTION public.voxel_trade(_user uuid, _offer text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE give jsonb; get_kind text; get_n int;
BEGIN
  SELECT g, k, n INTO give, get_kind, get_n FROM (VALUES
    ('grass_log', '{"grass":4}'::jsonb, 'log', 1),
    ('dirt_brick', '{"dirt":5}'::jsonb, 'brick', 1),
    ('sand_glass', '{"sand":3}'::jsonb, 'glass', 2),
    ('cobble_gold', '{"cobble":10}'::jsonb, 'gold', 1),
    ('planks_cobble', '{"planks":4}'::jsonb, 'cobble', 3),
    ('brick_stone', '{"brick":2}'::jsonb, 'stone', 3)
  ) t(id, g, k, n) WHERE id = _offer;
  IF give IS NULL THEN RETURN 'NO SUCH TRADE'; END IF;
  PERFORM voxel_bag_ensure(_user);
  PERFORM voxel_pay(_user, give);
  IF NOT voxel_bag_add(_user, get_kind, get_n) THEN RAISE EXCEPTION 'bag full'; END IF;
  RETURN 'ok';
EXCEPTION WHEN raise_exception THEN RETURN 'NOT ENOUGH MATERIALS';
END $$;

-- Harvest now honours the best pickaxe (faster, bigger yield).
CREATE OR REPLACE FUNCTION public.voxel_harvest(_user uuid, _kind text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last timestamptz; cd int := 700; yield int := 1;
BEGIN
  IF _kind NOT IN ('grass','dirt','sand','cobble') THEN RETURN 'CANNOT GATHER THAT'; END IF;
  PERFORM voxel_bag_ensure(_user);
  IF EXISTS (SELECT 1 FROM voxel_tools WHERE user_id=_user AND tool='glow_pickaxe') THEN cd := 150; yield := 3;
  ELSIF EXISTS (SELECT 1 FROM voxel_tools WHERE user_id=_user AND tool='gold_pickaxe') THEN cd := 220; yield := 2;
  ELSIF EXISTS (SELECT 1 FROM voxel_tools WHERE user_id=_user AND tool='stone_pickaxe') THEN cd := 320; yield := CASE WHEN random() < 0.25 THEN 2 ELSE 1 END;
  ELSIF EXISTS (SELECT 1 FROM voxel_tools WHERE user_id=_user AND tool='wood_pickaxe') THEN cd := 450;
  END IF;
  SELECT last_harvest_at INTO last FROM voxel_bag_meta WHERE user_id=_user FOR UPDATE;
  IF last > now() - make_interval(secs => cd / 1000.0) THEN RETURN 'TOO FAST'; END IF;
  IF NOT voxel_bag_add(_user, _kind, yield) THEN RETURN 'BAG FULL'; END IF;
  UPDATE voxel_bag_meta SET last_harvest_at = now() WHERE user_id=_user;
  RETURN 'ok';
END $$;

-- Stamp a starter template: pays the full bill, then fills only empty cells.
CREATE OR REPLACE FUNCTION public.voxel_stamp(_user uuid, _blocks jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b jsonb; cost jsonb := '{}'::jsonb; k text;
BEGIN
  IF jsonb_array_length(_blocks) > 600 THEN RETURN 'TEMPLATE TOO BIG'; END IF;
  PERFORM voxel_bag_ensure(_user);
  FOR b IN SELECT * FROM jsonb_array_elements(_blocks) LOOP
    k := b->>'k';
    IF NOT EXISTS (SELECT 1 FROM oasis_voxels WHERE x=(b->>'x')::int AND y=(b->>'y')::int AND z=(b->>'z')::int AND kind <> 'air') THEN
      cost := jsonb_set(cost, ARRAY[k], to_jsonb(COALESCE((cost->>k)::int, 0) + 1));
    END IF;
  END LOOP;
  PERFORM voxel_pay(_user, cost);
  INSERT INTO oasis_voxels(x,y,z,kind,placed_by,updated_at)
  SELECT (e->>'x')::int, (e->>'y')::int, (e->>'z')::int, e->>'k', _user, now() FROM jsonb_array_elements(_blocks) e
  ON CONFLICT (x,y,z) DO UPDATE SET kind=EXCLUDED.kind, placed_by=EXCLUDED.placed_by, updated_at=now()
  WHERE oasis_voxels.kind = 'air';
  RETURN 'ok';
EXCEPTION WHEN raise_exception THEN RETURN 'NOT ENOUGH MATERIALS';
END $$;

REVOKE ALL ON FUNCTION public.voxel_pay(uuid,jsonb), public.voxel_forge(uuid,text), public.voxel_trade(uuid,text),
  public.voxel_harvest(uuid,text), public.voxel_stamp(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voxel_pay(uuid,jsonb), public.voxel_forge(uuid,text), public.voxel_trade(uuid,text),
  public.voxel_harvest(uuid,text), public.voxel_stamp(uuid,jsonb) TO service_role;