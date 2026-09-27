ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'donation',
  ADD COLUMN IF NOT EXISTS qualifying_trait text;

CREATE TABLE public.trait_holder_badges (
  address text PRIMARY KEY,
  trait_ids text[] NOT NULL DEFAULT '{}',
  bitmap_height bigint NOT NULL,
  inscription_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.trait_holder_badges TO anon, authenticated;
GRANT ALL ON public.trait_holder_badges TO service_role;

ALTER TABLE public.trait_holder_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verified trait holder badges are public"
ON public.trait_holder_badges FOR SELECT TO anon, authenticated
USING (active = true AND expires_at > now());

CREATE TRIGGER update_trait_holder_badges_updated_at
BEFORE UPDATE ON public.trait_holder_badges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX trait_holder_badges_active_expiry_idx
ON public.trait_holder_badges (active, expires_at);

GRANT SELECT (address, status, expires_at, source, qualifying_trait) ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;