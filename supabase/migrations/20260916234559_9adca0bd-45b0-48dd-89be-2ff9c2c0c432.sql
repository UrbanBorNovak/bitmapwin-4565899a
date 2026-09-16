DROP VIEW IF EXISTS public.membership_badges;
DROP POLICY IF EXISTS "Members read their own membership" ON public.memberships;

REVOKE SELECT ON public.memberships FROM anon, authenticated;
GRANT SELECT (address, status, expires_at) ON public.memberships TO anon, authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE POLICY "Membership badge is public"
ON public.memberships FOR SELECT TO anon, authenticated
USING (true);