CREATE OR REPLACE FUNCTION public.is_clan_member(_user_id uuid, _clan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM public.clan_members
    WHERE clan_id = _clan_id
      AND user_id = _user_id
      AND status = 'accepted'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) TO authenticated, service_role;