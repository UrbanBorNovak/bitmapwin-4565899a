CREATE TABLE public.provenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_wallet text,
  bitmap_height bigint,
  source_type text NOT NULL,
  source_id text NOT NULL,
  proof_level text NOT NULL CHECK (proof_level IN ('CHAIN', 'WORLD', 'ACCOUNT')),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provenance_events TO anon, authenticated;
GRANT ALL ON public.provenance_events TO service_role;
ALTER TABLE public.provenance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public provenance is readable" ON public.provenance_events FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY "Players can read their private provenance" ON public.provenance_events FOR SELECT TO authenticated USING (actor_user_id = auth.uid());

CREATE INDEX provenance_events_stream_idx ON public.provenance_events (occurred_at DESC, id DESC) WHERE visibility = 'public';
CREATE INDEX provenance_events_actor_idx ON public.provenance_events (actor_user_id, occurred_at DESC);
CREATE INDEX provenance_events_wallet_idx ON public.provenance_events (actor_wallet, occurred_at DESC) WHERE actor_wallet IS NOT NULL;
CREATE INDEX provenance_events_bitmap_idx ON public.provenance_events (bitmap_height, occurred_at DESC) WHERE bitmap_height IS NOT NULL;
CREATE INDEX provenance_events_kind_idx ON public.provenance_events (event_type, occurred_at DESC);

CREATE TABLE public.passport_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  stamp_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  evidence_event_id uuid NOT NULL REFERENCES public.provenance_events(id) ON DELETE RESTRICT,
  evidence_source_type text NOT NULL,
  evidence_source_id text NOT NULL,
  bitmap_height bigint,
  rule_version integer NOT NULL DEFAULT 1,
  inscription_id text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  earned_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stamp_key)
);
GRANT SELECT ON public.passport_stamps TO anon, authenticated;
GRANT ALL ON public.passport_stamps TO service_role;
ALTER TABLE public.passport_stamps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public stamps are readable" ON public.passport_stamps FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY "Players can read their private stamps" ON public.passport_stamps FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX passport_stamps_wallet_idx ON public.passport_stamps (wallet_address, earned_at DESC);
CREATE INDEX passport_stamps_user_idx ON public.passport_stamps (user_id, earned_at DESC);

CREATE TABLE public.passport_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  wallet_address text NOT NULL,
  capability_key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  granted_by_stamp_id uuid NOT NULL REFERENCES public.passport_stamps(id) ON DELETE RESTRICT,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, capability_key)
);
GRANT SELECT ON public.passport_unlocks TO anon, authenticated;
GRANT ALL ON public.passport_unlocks TO service_role;
ALTER TABLE public.passport_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public unlocks are readable" ON public.passport_unlocks FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY "Players can read their private unlocks" ON public.passport_unlocks FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX passport_unlocks_wallet_idx ON public.passport_unlocks (wallet_address, granted_at DESC);
CREATE INDEX passport_unlocks_user_idx ON public.passport_unlocks (user_id, granted_at DESC);

CREATE OR REPLACE FUNCTION public.has_passport_unlock(_user_id uuid, _capability_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.passport_unlocks
    WHERE user_id = _user_id
      AND capability_key = _capability_key
  )
$$;
REVOKE ALL ON FUNCTION public.has_passport_unlock(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_passport_unlock(uuid, text) TO authenticated, service_role;