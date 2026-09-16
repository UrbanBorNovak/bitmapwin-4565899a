DROP POLICY IF EXISTS "Membership status is public" ON public.memberships;
REVOKE SELECT ON public.memberships FROM anon;
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

CREATE POLICY "Members read their own membership"
ON public.memberships FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.wallet_links wl
    WHERE wl.user_id = auth.uid() AND wl.address = memberships.address
  )
);

CREATE OR REPLACE VIEW public.membership_badges
WITH (security_invoker = false) AS
SELECT m.address,
       (m.status = 'active' AND m.expires_at IS NOT NULL AND m.expires_at > now()) AS active
FROM public.memberships m;

GRANT SELECT ON public.membership_badges TO anon, authenticated;