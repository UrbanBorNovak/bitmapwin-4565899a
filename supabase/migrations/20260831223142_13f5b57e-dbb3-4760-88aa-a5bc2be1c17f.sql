REVOKE EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) TO authenticated, service_role;