CREATE OR REPLACE FUNCTION public.owns_wallet(_user_id uuid, _address text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.wallet_links
      WHERE user_id = _user_id AND lower(address) = lower(_address)
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.owns_wallet_address(_address text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.wallet_links
    WHERE user_id = auth.uid() AND address = _address
  )
$$;

CREATE OR REPLACE FUNCTION public.can_build_bitmap(_user_id uuid, _height bigint, _owner_address text)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.owns_wallet(_user_id, _owner_address)
      OR EXISTS (
        SELECT 1 FROM public.build_delegates bd
        JOIN public.wallet_links wl ON wl.address = bd.delegate_address
        WHERE bd.bitmap_height = _height AND wl.user_id = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.leases l
        JOIN public.wallet_links wl ON wl.address = l.lessee_address
        WHERE l.bitmap_height = _height AND wl.user_id = _user_id
          AND l.status = 'active' AND l.ends_at > now()
      )
  END
$$;

GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_wallet_address(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) TO authenticated, service_role;