DROP POLICY IF EXISTS "Membership badge is public" ON public.memberships;
DROP POLICY IF EXISTS "Members read their own membership" ON public.memberships;

REVOKE SELECT ON public.memberships FROM anon, authenticated;
GRANT SELECT (address, status, expires_at) ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE POLICY "Members read their own membership"
ON public.memberships FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.wallet_links wl
    WHERE wl.user_id = auth.uid() AND wl.address = memberships.address
  )
);

CREATE OR REPLACE FUNCTION public.membership_badge(_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.address = _address
      AND m.status = 'active'
      AND m.expires_at IS NOT NULL
      AND m.expires_at > now()
  )
$$;

REVOKE ALL ON FUNCTION public.membership_badge(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.membership_badge(text) TO anon, authenticated;