GRANT SELECT ON public.bitmon_guardians TO anon, authenticated;
GRANT ALL ON public.bitmon_guardians TO service_role;

GRANT SELECT ON public.bitmon_summon_orders TO authenticated;
GRANT ALL ON public.bitmon_summon_orders TO service_role;

GRANT SELECT ON public.guardian_raids TO anon, authenticated;
GRANT ALL ON public.guardian_raids TO service_role;

GRANT SELECT ON public.bitmap_spoils TO anon, authenticated;
GRANT ALL ON public.bitmap_spoils TO service_role;

GRANT SELECT (id, guardian_height, directive, target_height, waypoints, started_at, ends_at, recalled_at, created_at, repeat) ON public.guardian_dispatches TO anon, authenticated;
GRANT ALL ON public.guardian_dispatches TO service_role;