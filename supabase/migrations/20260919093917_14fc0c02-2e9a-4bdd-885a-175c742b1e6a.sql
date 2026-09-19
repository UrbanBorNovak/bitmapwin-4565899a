CREATE TABLE public.rank_clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE CHECK (tag ~ '^[A-Z0-9]{2,6}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 24),
  crest_color text NOT NULL DEFAULT '#f7931a',
  motto text NOT NULL DEFAULT '',
  leader_id uuid,
  level integer NOT NULL DEFAULT 1,
  fame bigint NOT NULL DEFAULT 0,
  pk_kills integer NOT NULL DEFAULT 0,
  members_count integer NOT NULL DEFAULT 0,
  home_bitmap bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rank_clans TO anon, authenticated;
GRANT ALL ON public.rank_clans TO service_role;
ALTER TABLE public.rank_clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking clans are public" ON public.rank_clans FOR SELECT USING (true);

CREATE TABLE public.rank_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  wallet text,
  name text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Novice',
  level integer NOT NULL DEFAULT 1,
  fame bigint NOT NULL DEFAULT 0,
  karma integer NOT NULL DEFAULT 0,
  pk_kills integer NOT NULL DEFAULT 0,
  pvp_kills integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  chaotic_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'peaceful' CHECK (status IN ('peaceful','flagged','chaotic','hero')),
  clan_id uuid REFERENCES public.rank_clans(id) ON DELETE SET NULL,
  home_bitmap bigint,
  last_district text,
  last_kill_at timestamptz,
  last_death_at timestamptz,
  bit_earned bigint NOT NULL DEFAULT 0,
  districts_visited integer NOT NULL DEFAULT 0,
  builds_maintained integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rank_players TO anon, authenticated;
GRANT ALL ON public.rank_players TO service_role;
ALTER TABLE public.rank_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking players are public" ON public.rank_players FOR SELECT USING (true);
CREATE INDEX rank_players_clan_idx ON public.rank_players (clan_id);

CREATE TABLE public.rank_clan_members (
  clan_id uuid NOT NULL REFERENCES public.rank_clans(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.rank_players(id) ON DELETE CASCADE,
  rank text NOT NULL DEFAULT 'member' CHECK (rank IN ('leader','knight','member','academy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clan_id, player_id)
);
GRANT SELECT ON public.rank_clan_members TO anon, authenticated;
GRANT ALL ON public.rank_clan_members TO service_role;
ALTER TABLE public.rank_clan_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ranking clan rosters are public" ON public.rank_clan_members FOR SELECT USING (true);

CREATE TABLE public.pvp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  killer_id uuid REFERENCES public.rank_players(id) ON DELETE SET NULL,
  victim_id uuid REFERENCES public.rank_players(id) ON DELETE SET NULL,
  district text,
  bitmap bigint,
  karma_delta integer NOT NULL DEFAULT 0,
  was_pk boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pvp_events TO anon, authenticated;
GRANT ALL ON public.pvp_events TO service_role;
ALTER TABLE public.pvp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PvP events are public" ON public.pvp_events FOR SELECT USING (true);
CREATE INDEX pvp_events_created_idx ON public.pvp_events (created_at DESC);
CREATE INDEX pvp_events_killer_idx ON public.pvp_events (killer_id);
CREATE INDEX pvp_events_victim_idx ON public.pvp_events (victim_id);

CREATE TRIGGER rank_clans_touch BEFORE UPDATE ON public.rank_clans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER rank_players_touch BEFORE UPDATE ON public.rank_players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.rank_clans (id, tag, name, crest_color, motto, level, fame, pk_kills, members_count, home_bitmap) VALUES
  ('11111111-1111-4111-8111-000000000001','JGH','jghphhhf','#f7931a','WE WERE HERE BEFORE THE BLOCKS',5,18400,64,6,65022),
  ('11111111-1111-4111-8111-000000000002','OAS','Oasis','#22d3ee','THE WATER BELONGS TO EVERYONE',4,15230,21,5,420069),
  ('11111111-1111-4111-8111-000000000003','RED','Red Moon','#ef4444','BLOOD IS A LEDGER TOO',4,12980,118,4,777777),
  ('11111111-1111-4111-8111-000000000004','BIT','Bitmap Guard','#e5e7eb','NO BLOCK LEFT UNWATCHED',3,9860,9,4,840000),
  ('11111111-1111-4111-8111-000000000005','GRN','Giran Traders','#facc15','EVERY SAT HAS A PRICE',3,7420,3,3,123456),
  ('11111111-1111-4111-8111-000000000006','ADN','Aden Watch','#a78bfa','THE WARDENS NEVER SLEEP',2,5110,14,2,555000);

INSERT INTO public.rank_players (id, name, title, level, fame, karma, pk_kills, pvp_kills, deaths, chaotic_count, status, clan_id, home_bitmap, last_district, last_kill_at, last_death_at, bit_earned, districts_visited, builds_maintained) VALUES
  ('22222222-2222-4222-8222-000000000001','crT','Duke',66,4820,0,4,192,71,1,'hero','11111111-1111-4111-8111-000000000001',65022,'GIRAN GATE', now() - interval '2 hours', now() - interval '3 days', 184000, 212, 14),
  ('22222222-2222-4222-8222-000000000002','Urban','Count',57,3610,-40,9,120,58,2,'flagged','11111111-1111-4111-8111-000000000001',420069,'OASIS SPRING', now() - interval '5 hours', now() - interval '1 day', 141000, 176, 9),
  ('22222222-2222-4222-8222-000000000003','GiranScout','Baron',44,2180,0,0,61,44,0,'peaceful','11111111-1111-4111-8111-000000000005',123456,'TRADING POST', now() - interval '1 day', now() - interval '2 days', 96000, 143, 6),
  ('22222222-2222-4222-8222-000000000004','AdenWarden','Baron',41,1960,0,1,54,49,0,'peaceful','11111111-1111-4111-8111-000000000006',555000,'ADEN RIDGE', now() - interval '9 hours', now() - interval '4 hours', 88000, 131, 11),
  ('22222222-2222-4222-8222-000000000005','BloodOfNine','Count',52,2870,-420,38,88,66,5,'chaotic','11111111-1111-4111-8111-000000000003',777777,'RED DUNES', now() - interval '40 minutes', now() - interval '2 days', 77000, 118, 1),
  ('22222222-2222-4222-8222-000000000006','SatanicMiner','Knight',36,1480,-260,27,44,72,3,'chaotic','11111111-1111-4111-8111-000000000003',777778,'LAVA FLATS', now() - interval '3 hours', now() - interval '6 hours', 61000, 97, 0),
  ('22222222-2222-4222-8222-000000000007','NullPointer','Knight',33,1120,-180,19,37,51,2,'chaotic',NULL,314159,'GLASS EDGE', now() - interval '11 hours', now() - interval '1 day', 43000, 88, 2),
  ('22222222-2222-4222-8222-000000000008','OasisKeeper','Duke',61,3980,0,0,74,29,0,'hero','11111111-1111-4111-8111-000000000002',420070,'OASIS SPRING', now() - interval '2 days', now() - interval '5 days', 152000, 190, 21),
  ('22222222-2222-4222-8222-000000000009','SandWalker','Warden',24,760,0,0,18,31,0,'peaceful','11111111-1111-4111-8111-000000000002',420071,'DUST ROAD', now() - interval '3 days', now() - interval '1 day', 29000, 64, 4),
  ('22222222-2222-4222-8222-000000000010','BlockJester','Warden',28,880,-12,2,26,37,1,'flagged',NULL,690000,'GIRAN GATE', now() - interval '18 hours', now() - interval '20 hours', 34000, 71, 3),
  ('22222222-2222-4222-8222-000000000011','GuardOfBedrock','Count',50,2410,0,0,49,22,0,'hero','11111111-1111-4111-8111-000000000004',840000,'BEDROCK KEEP', now() - interval '4 days', now() - interval '7 days', 119000, 158, 17),
  ('22222222-2222-4222-8222-000000000012','StoneMason','Knight',31,1010,0,0,15,19,0,'peaceful','11111111-1111-4111-8111-000000000004',840001,'BEDROCK KEEP', now() - interval '6 days', now() - interval '8 days', 52000, 83, 12),
  ('22222222-2222-4222-8222-000000000013','TinyElf','Scout',14,240,0,0,6,14,0,'peaceful','11111111-1111-4111-8111-000000000002',420072,'OASIS SPRING', now() - interval '8 days', now() - interval '2 days', 11000, 37, 1),
  ('22222222-2222-4222-8222-000000000014','DarkElfOfDion','Baron',46,2240,-60,5,58,41,1,'flagged','11111111-1111-4111-8111-000000000006',555001,'DION PASS', now() - interval '7 hours', now() - interval '12 hours', 91000, 127, 5),
  ('22222222-2222-4222-8222-000000000015','HunterOfSats','Warden',22,610,0,0,12,16,0,'peaceful','11111111-1111-4111-8111-000000000005',123457,'TRADING POST', now() - interval '5 days', now() - interval '3 days', 24000, 58, 2),
  ('22222222-2222-4222-8222-000000000016','OrcOfGludio','Knight',38,1560,-20,3,42,39,1,'flagged','11111111-1111-4111-8111-000000000003',777779,'RED DUNES', now() - interval '1 day', now() - interval '9 hours', 68000, 104, 0),
  ('22222222-2222-4222-8222-000000000017','LedgerMonk','Baron',43,2020,0,0,33,18,0,'peaceful','11111111-1111-4111-8111-000000000001',65023,'GIRAN GATE', now() - interval '2 days', now() - interval '4 days', 87000, 122, 8),
  ('22222222-2222-4222-8222-000000000018','MempoolGhost','Scout',17,320,0,0,9,21,0,'peaceful','11111111-1111-4111-8111-000000000001',65024,'MEMPOOL MARSH', now() - interval '9 days', now() - interval '1 day', 14000, 44, 1),
  ('22222222-2222-4222-8222-000000000019','SilverHawk','Count',55,3150,0,1,67,34,0,'hero','11111111-1111-4111-8111-000000000001',65025,'GIRAN GATE', now() - interval '13 hours', now() - interval '2 days', 133000, 167, 13),
  ('22222222-2222-4222-8222-000000000020','SandRaider','Novice',8,90,-30,2,4,25,1,'flagged',NULL,999999,'DUST ROAD', now() - interval '16 hours', now() - interval '5 hours', 4000, 19, 0),
  ('22222222-2222-4222-8222-000000000021','FrozenOrc','Warden',26,700,0,0,21,27,0,'peaceful','11111111-1111-4111-8111-000000000004',840002,'ICE SHELF', now() - interval '4 days', now() - interval '3 days', 31000, 69, 6),
  ('22222222-2222-4222-8222-000000000022','KingOfNothing','King',71,5240,0,2,204,88,0,'hero','11111111-1111-4111-8111-000000000002',420073,'OASIS SPRING', now() - interval '1 hour', now() - interval '6 hours', 205000, 241, 26),
  ('22222222-2222-4222-8222-000000000023','GludinFisher','Scout',12,180,0,0,3,11,0,'peaceful','11111111-1111-4111-8111-000000000005',123458,'GLUDIN SHORE', now() - interval '11 days', now() - interval '6 days', 9000, 31, 3),
  ('22222222-2222-4222-8222-000000000024','ShadowOfBlocks','Duke',63,4110,-90,7,142,63,2,'flagged','11111111-1111-4111-8111-000000000006',555002,'ADEN RIDGE', now() - interval '3 hours', now() - interval '1 day', 161000, 198, 10);

UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000001' WHERE tag = 'JGH';
UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000008' WHERE tag = 'OAS';
UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000005' WHERE tag = 'RED';
UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000011' WHERE tag = 'BIT';
UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000003' WHERE tag = 'GRN';
UPDATE public.rank_clans SET leader_id = '22222222-2222-4222-8222-000000000004' WHERE tag = 'ADN';

INSERT INTO public.rank_clan_members (clan_id, player_id, rank)
SELECT p.clan_id, p.id,
  CASE WHEN c.leader_id = p.id THEN 'leader'
       WHEN p.level >= 40 THEN 'knight'
       WHEN p.level < 20 THEN 'academy'
       ELSE 'member' END
FROM public.rank_players p JOIN public.rank_clans c ON c.id = p.clan_id;

UPDATE public.rank_clans c SET members_count = (SELECT count(*) FROM public.rank_clan_members m WHERE m.clan_id = c.id);

INSERT INTO public.pvp_events (killer_id, victim_id, district, bitmap, karma_delta, was_pk, created_at) VALUES
  ('22222222-2222-4222-8222-000000000005','22222222-2222-4222-8222-000000000009','RED DUNES',777777,-150,true, now() - interval '40 minutes'),
  ('22222222-2222-4222-8222-000000000001','22222222-2222-4222-8222-000000000005','GIRAN GATE',65022,50,false, now() - interval '2 hours'),
  ('22222222-2222-4222-8222-000000000022','22222222-2222-4222-8222-000000000007','OASIS SPRING',420073,50,false, now() - interval '1 hour'),
  ('22222222-2222-4222-8222-000000000006','22222222-2222-4222-8222-000000000013','LAVA FLATS',777778,-150,true, now() - interval '3 hours'),
  ('22222222-2222-4222-8222-000000000024','22222222-2222-4222-8222-000000000006','ADEN RIDGE',555002,50,false, now() - interval '3 hours'),
  ('22222222-2222-4222-8222-000000000002','22222222-2222-4222-8222-000000000020','OASIS SPRING',420069,-150,true, now() - interval '5 hours'),
  ('22222222-2222-4222-8222-000000000004','22222222-2222-4222-8222-000000000016','ADEN RIDGE',555000,50,false, now() - interval '9 hours'),
  ('22222222-2222-4222-8222-000000000019','22222222-2222-4222-8222-000000000007','GIRAN GATE',65025,50,false, now() - interval '13 hours'),
  ('22222222-2222-4222-8222-000000000010','22222222-2222-4222-8222-000000000023','GIRAN GATE',690000,-150,true, now() - interval '18 hours'),
  ('22222222-2222-4222-8222-000000000014','22222222-2222-4222-8222-000000000015','DION PASS',555001,-150,true, now() - interval '7 hours');