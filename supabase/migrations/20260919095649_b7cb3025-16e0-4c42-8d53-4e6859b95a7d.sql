ALTER FUNCTION public.join_rank_clan(uuid, text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.join_rank_clan(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_rank_clan(uuid, text) TO service_role;