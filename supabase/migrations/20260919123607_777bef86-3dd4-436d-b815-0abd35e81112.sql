ALTER TABLE public.player_builds
  ADD COLUMN IF NOT EXISTS clan_id uuid REFERENCES public.clans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clan_tag text;

CREATE INDEX IF NOT EXISTS player_builds_clan_idx ON public.player_builds (clan_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_builds_clan_tag_idx ON public.player_builds (clan_tag);

CREATE OR REPLACE FUNCTION public.is_clan_member(_user_id uuid, _clan_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1 FROM public.clan_members
    WHERE clan_id = _clan_id
      AND user_id = _user_id
      AND status = 'accepted'
  )
$$;

DROP POLICY IF EXISTS "Clan mates can view clan builds" ON public.player_builds;
CREATE POLICY "Clan mates can view clan builds"
ON public.player_builds
FOR SELECT
TO authenticated
USING (clan_id IS NOT NULL AND public.is_clan_member(auth.uid(), clan_id));

CREATE OR REPLACE FUNCTION public.clan_builds_by_tag(_tag text)
RETURNS TABLE(id uuid, kind text, bitmap_height bigint, chunk_key text, x numeric, z numeric, yaw numeric, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.id, b.kind, b.bitmap_height, b.chunk_key, b.x, b.z, b.yaw, b.created_at
  FROM public.player_builds b
  WHERE b.clan_tag = upper(_tag)
  ORDER BY b.created_at DESC
  LIMIT 200
$$;

GRANT EXECUTE ON FUNCTION public.clan_builds_by_tag(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_clan_member(uuid, uuid) TO authenticated, service_role;