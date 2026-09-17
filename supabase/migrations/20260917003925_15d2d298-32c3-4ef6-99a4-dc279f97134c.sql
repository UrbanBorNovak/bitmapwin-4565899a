REVOKE SELECT ON public.clans FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clans FROM authenticated;
REVOKE SELECT ON public.clan_members FROM anon;
DROP POLICY "Accepted clan memberships are public" ON public.clan_members;
REVOKE EXECUTE ON FUNCTION public.create_clan(text, text, text) FROM authenticated;
DROP POLICY "Players create their own clan" ON public.clans;
DROP POLICY "Leaders update their clan" ON public.clans;
DROP POLICY "Leaders delete their clan" ON public.clans;