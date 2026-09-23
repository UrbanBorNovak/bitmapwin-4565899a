CREATE TABLE public.play_tables (
  code text PRIMARY KEY,
  status text NOT NULL DEFAULT 'waiting',
  host_name text NOT NULL DEFAULT 'A traveller',
  guest_name text,
  host_heights bigint[] NOT NULL DEFAULT '{}',
  host_token_hash text NOT NULL,
  guest_token_hash text,
  state jsonb,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (code, status, host_name, guest_name, state, version, created_at, updated_at) ON public.play_tables TO anon, authenticated;
GRANT ALL ON public.play_tables TO service_role;
ALTER TABLE public.play_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tables are publicly viewable" ON public.play_tables FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE public.play_tables REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.play_tables;