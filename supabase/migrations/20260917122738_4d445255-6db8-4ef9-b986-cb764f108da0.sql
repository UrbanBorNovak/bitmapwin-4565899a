REVOKE EXECUTE ON FUNCTION public.world_metrics() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.world_metrics_daily(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.world_metrics() TO service_role;
GRANT EXECUTE ON FUNCTION public.world_metrics_daily(integer) TO service_role;