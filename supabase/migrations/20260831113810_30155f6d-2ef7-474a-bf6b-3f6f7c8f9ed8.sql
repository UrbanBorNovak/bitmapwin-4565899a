CREATE TABLE public.wallet_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  purpose text NOT NULL DEFAULT 'ordinals',
  public_key text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wallet_links_address_key ON public.wallet_links (lower(address));
CREATE INDEX wallet_links_user_idx ON public.wallet_links (user_id);

GRANT SELECT ON public.wallet_links TO authenticated;
GRANT SELECT ON public.wallet_links TO anon;
GRANT ALL ON public.wallet_links TO service_role;

ALTER TABLE public.wallet_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_links_public_read ON public.wallet_links
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY wallet_links_owner_delete ON public.wallet_links
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.wallet_link_challenges (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.wallet_link_challenges TO service_role;
ALTER TABLE public.wallet_link_challenges ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_wallet(_user_id uuid, _address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wallet_links
    WHERE user_id = _user_id
      AND lower(address) = lower(_address)
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO authenticated;

ALTER TABLE public.wallet_profiles
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS wallet_profiles_public_insert ON public.wallet_profiles;
DROP POLICY IF EXISTS wallet_profiles_public_update ON public.wallet_profiles;

CREATE POLICY wallet_profiles_owner_insert ON public.wallet_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), address));

CREATE POLICY wallet_profiles_owner_update ON public.wallet_profiles
  FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), address))
  WITH CHECK (public.owns_wallet(auth.uid(), address));

REVOKE INSERT, UPDATE ON public.wallet_profiles FROM anon;

DROP POLICY IF EXISTS parcel_pages_public_insert ON public.parcel_pages;
DROP POLICY IF EXISTS parcel_pages_public_update ON public.parcel_pages;

CREATE POLICY parcel_pages_owner_insert ON public.parcel_pages
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));

CREATE POLICY parcel_pages_owner_update ON public.parcel_pages
  FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address))
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));

REVOKE INSERT, UPDATE ON public.parcel_pages FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.wallet_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.parcel_pages TO authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;
GRANT ALL ON public.parcel_pages TO service_role;