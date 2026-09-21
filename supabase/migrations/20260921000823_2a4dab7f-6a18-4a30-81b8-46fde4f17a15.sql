REVOKE EXECUTE ON FUNCTION public.clan_builds_by_tag(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) TO authenticated;