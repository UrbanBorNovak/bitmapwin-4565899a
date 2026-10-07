CREATE TABLE public.epic_bosses (
  slug text PRIMARY KEY,
  hp integer NOT NULL,
  max_hp integer NOT NULL,
  spawned_at timestamptz NOT NULL DEFAULT now(),
  respawn_at timestamptz,
  kills integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.epic_bosses TO anon, authenticated;
GRANT ALL ON public.epic_bosses TO service_role;
ALTER TABLE public.epic_bosses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see boss state" ON public.epic_bosses FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.boss_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_slug text NOT NULL,
  guardian_height bigint NOT NULL,
  user_id uuid NOT NULL,
  damage integer NOT NULL,
  spawn_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX boss_strikes_g ON public.boss_strikes (guardian_height, created_at DESC);
CREATE INDEX boss_strikes_b ON public.boss_strikes (boss_slug, spawn_at);
GRANT SELECT ON public.boss_strikes TO anon, authenticated;
GRANT ALL ON public.boss_strikes TO service_role;
ALTER TABLE public.boss_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see boss strikes" ON public.boss_strikes FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.guardian_loot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_height bigint NOT NULL,
  boss_slug text NOT NULL,
  item text NOT NULL,
  rarity text NOT NULL,
  bit integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_loot_g ON public.guardian_loot (guardian_height);
GRANT SELECT ON public.guardian_loot TO anon, authenticated;
GRANT ALL ON public.guardian_loot TO service_role;
ALTER TABLE public.guardian_loot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can see guardian loot" ON public.guardian_loot FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.epic_bosses (slug, hp, max_hp) VALUES
 ('queen-ant', 2000, 2000), ('orfen', 2800, 2800), ('core', 2600, 2600),
 ('zaken', 3500, 3500), ('baium', 4500, 4500), ('antharas', 5500, 5500), ('valakas', 6000, 6000),
 ('decarbia', 1200, 1200), ('ember', 900, 900), ('golkonda', 1000, 1000);