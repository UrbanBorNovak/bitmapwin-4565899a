ALTER TABLE public.launch_seats ADD COLUMN ticket_inscription_id text UNIQUE;
CREATE TABLE public.broadcast_sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('cafe','launch','all')),
  title text NOT NULL,
  handle text NOT NULL DEFAULT '',
  media_kind text NOT NULL CHECK (media_kind IN ('inscription','image')),
  media text NOT NULL,
  payer_address text NOT NULL,
  pay_txid text NOT NULL UNIQUE,
  paid_sats integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, slot, title, handle, media_kind, media, starts_at, ends_at) ON public.broadcast_sponsorships TO anon, authenticated;
GRANT ALL ON public.broadcast_sponsorships TO service_role;
ALTER TABLE public.broadcast_sponsorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sponsor slides are public" ON public.broadcast_sponsorships FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX broadcast_sponsorships_ends_idx ON public.broadcast_sponsorships (ends_at);