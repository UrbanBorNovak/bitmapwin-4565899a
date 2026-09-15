CREATE OR REPLACE FUNCTION public.can_build_on_height(_height bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE (
    EXISTS (
      SELECT 1 FROM public.bitmap_index b
      JOIN public.wallet_links wl ON lower(wl.address) = lower(b.owner_address)
      WHERE b.block_height = _height AND wl.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.build_delegates bd
      JOIN public.wallet_links wl ON lower(wl.address) = lower(bd.delegate_address)
      WHERE bd.bitmap_height = _height AND wl.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leases l
      JOIN public.wallet_links wl ON lower(wl.address) = lower(l.lessee_address)
      WHERE l.bitmap_height = _height AND wl.user_id = auth.uid()
        AND l.status = 'active' AND l.ends_at > now()
    )
    OR EXISTS (
      SELECT 1 FROM public.land_grants g
      LEFT JOIN public.wallet_links wl ON lower(wl.address) = lower(g.grantee_address)
      WHERE g.bitmap_height = _height
        AND (g.expires_at IS NULL OR g.expires_at > now())
        AND (g.grantee_user_id = auth.uid() OR wl.user_id = auth.uid())
    )
  ) END
$$;

REVOKE ALL ON FUNCTION public.can_build_on_height(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_build_on_height(bigint) TO authenticated, service_role;