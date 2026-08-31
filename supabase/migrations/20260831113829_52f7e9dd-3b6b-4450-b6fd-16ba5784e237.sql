REVOKE EXECUTE ON FUNCTION public.owns_wallet(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owns_wallet(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) TO authenticated;

COMMENT ON TABLE public.wallet_link_challenges IS 'Server-only: one-time wallet signing challenges. No RLS policies by design; reachable only through the service role.';