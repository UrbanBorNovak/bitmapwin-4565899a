CREATE TABLE public.speed_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  pub_hex text NOT NULL,
  lo_hex text NOT NULL,
  hi_hex text NOT NULL,
  jumps int NOT NULL,
  dp_bits int NOT NULL,
  herd int NOT NULL DEFAULT 16,
  seed text NOT NULL,
  funded boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open',
  solved_key_hex text,
  winner_name text,
  winner_session uuid,
  solved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.speed_bounty_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES public.speed_bounties(id) ON DELETE CASCADE,
  seq int NOT NULL,
  name text NOT NULL,
  steps bigint NOT NULL DEFAULT 0,
  dps int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bounty_id, seq)
);
CREATE TABLE public.speed_bounty_dps (
  bounty_id uuid NOT NULL REFERENCES public.speed_bounties(id) ON DELETE CASCADE,
  x_hex text NOT NULL,
  tame boolean NOT NULL,
  dist_hex text NOT NULL,
  session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bounty_id, x_hex, tame)
);
GRANT ALL ON public.speed_bounties, public.speed_bounty_sessions, public.speed_bounty_dps TO service_role;
REVOKE ALL ON public.speed_bounties, public.speed_bounty_sessions, public.speed_bounty_dps FROM anon, authenticated;
ALTER TABLE public.speed_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_bounty_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_bounty_dps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny all" ON public.speed_bounties FOR ALL USING (false);
CREATE POLICY "deny all" ON public.speed_bounty_sessions FOR ALL USING (false);
CREATE POLICY "deny all" ON public.speed_bounty_dps FOR ALL USING (false);