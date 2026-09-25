ALTER TABLE public.play_tables
  ADD COLUMN host_user_id uuid,
  ADD COLUMN guest_user_id uuid,
  ADD COLUMN tournament_code text,
  ADD COLUMN host_entrant int,
  ADD COLUMN guest_entrant int,
  ADD COLUMN recorded boolean NOT NULL DEFAULT false;
GRANT SELECT (tournament_code, host_entrant, guest_entrant) ON public.play_tables TO anon, authenticated;

CREATE TABLE public.play_tournaments (
  code text PRIMARY KEY,
  name text NOT NULL,
  size int NOT NULL CHECK (size IN (4, 8)),
  status text NOT NULL DEFAULT 'open',
  players jsonb NOT NULL DEFAULT '[]'::jsonb,
  bracket jsonb NOT NULL DEFAULT '[]'::jsonb,
  champion int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.play_tournaments TO anon, authenticated;
GRANT ALL ON public.play_tournaments TO service_role;
ALTER TABLE public.play_tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tournaments are publicly viewable" ON public.play_tournaments FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.play_tournaments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.play_tournaments;

CREATE TABLE public.play_tournament_entrants (
  tournament_code text NOT NULL REFERENCES public.play_tournaments(code) ON DELETE CASCADE,
  entrant int NOT NULL,
  name text NOT NULL,
  heights bigint[] NOT NULL,
  token_hash text NOT NULL,
  user_id uuid,
  PRIMARY KEY (tournament_code, entrant)
);
GRANT ALL ON public.play_tournament_entrants TO service_role;
ALTER TABLE public.play_tournament_entrants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.play_season_standings (
  season text NOT NULL,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  wins int NOT NULL DEFAULT 0,
  losses int NOT NULL DEFAULT 0,
  titles int NOT NULL DEFAULT 0,
  points int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, user_id)
);
GRANT SELECT (season, display_name, wins, losses, titles, points, updated_at) ON public.play_season_standings TO anon, authenticated;
GRANT ALL ON public.play_season_standings TO service_role;
ALTER TABLE public.play_season_standings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Season standings are public" ON public.play_season_standings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.play_season_record(_season text, _user_id uuid, _name text, _win boolean, _title boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.play_season_standings AS s (season, user_id, display_name, wins, losses, titles, points)
  VALUES (_season, _user_id, _name, CASE WHEN _win THEN 1 ELSE 0 END, CASE WHEN _win THEN 0 ELSE 1 END,
          CASE WHEN _title THEN 1 ELSE 0 END, CASE WHEN _win THEN 3 ELSE 0 END + CASE WHEN _title THEN 5 ELSE 0 END)
  ON CONFLICT (season, user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    wins = s.wins + EXCLUDED.wins, losses = s.losses + EXCLUDED.losses,
    titles = s.titles + EXCLUDED.titles, points = s.points + EXCLUDED.points, updated_at = now();
$$;
REVOKE ALL ON FUNCTION public.play_season_record(text, uuid, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.play_season_record(text, uuid, text, boolean, boolean) TO service_role;