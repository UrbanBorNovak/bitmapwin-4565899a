ALTER TABLE public.rank_clans ADD COLUMN IF NOT EXISTS xp bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.clan_level_for_xp(_xp bigint)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN _xp >= 45000 THEN 7
    WHEN _xp >= 20000 THEN 6
    WHEN _xp >= 9000 THEN 5
    WHEN _xp >= 4000 THEN 4
    WHEN _xp >= 1500 THEN 3
    WHEN _xp >= 500 THEN 2
    ELSE 1
  END;
$$;

UPDATE public.rank_clans c
SET xp = GREATEST(c.xp, c.fame + (c.members_count * 250) + (c.pk_kills * 40)),
    updated_at = now();

UPDATE public.rank_clans c
SET level = public.clan_level_for_xp(c.xp);

CREATE OR REPLACE FUNCTION public.join_rank_clan_admin(_user_id uuid, _clan_id uuid, _wallet text)
RETURNS TABLE (clan_id uuid, player_id uuid, clan_tag text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _player public.rank_players%ROWTYPE;
  _clan public.rank_clans%ROWTYPE;
  _member_count integer;
  _name text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'SIGN IN TO JOIN A CLAN';
  END IF;

  IF _wallet IS NULL OR btrim(_wallet) = '' OR NOT public.owns_wallet(_user_id, _wallet) THEN
    RAISE EXCEPTION 'VERIFY THIS WALLET ON YOUR WALLET PAGE FIRST';
  END IF;

  SELECT * INTO _clan FROM public.rank_clans WHERE id = _clan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLAN NOT FOUND'; END IF;

  SELECT * INTO _player FROM public.rank_players WHERE user_id = _user_id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    SELECT * INTO _player
    FROM public.rank_players
    WHERE lower(wallet) = lower(_wallet) AND user_id IS NULL
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.rank_players
      SET user_id = _user_id, wallet = _wallet, updated_at = now()
      WHERE id = _player.id RETURNING * INTO _player;
    ELSE
      _name := 'WANDERER_' || upper(substr(md5(_user_id::text), 1, 8));
      INSERT INTO public.rank_players (user_id, wallet, name, title)
      VALUES (_user_id, _wallet, _name, 'Novice') RETURNING * INTO _player;
    END IF;
  END IF;

  IF _player.clan_id = _clan_id THEN
    RETURN QUERY SELECT _clan.id, _player.id, _clan.tag;
    RETURN;
  END IF;
  IF _player.clan_id IS NOT NULL THEN RAISE EXCEPTION 'LEAVE YOUR CURRENT CLAN BEFORE JOINING ANOTHER'; END IF;

  SELECT count(*)::integer INTO _member_count
  FROM public.rank_clan_members WHERE rank_clan_members.clan_id = _clan_id;
  IF _member_count >= 36 THEN RAISE EXCEPTION 'THIS CLAN IS FULL'; END IF;

  INSERT INTO public.rank_clan_members (clan_id, player_id, rank)
  VALUES (_clan_id, _player.id, 'member');
  UPDATE public.rank_players SET clan_id = _clan_id, updated_at = now() WHERE id = _player.id;
  UPDATE public.rank_clans
  SET members_count = (SELECT count(*)::integer FROM public.rank_clan_members WHERE rank_clan_members.clan_id = _clan_id),
      xp = rank_clans.xp + 250,
      level = public.clan_level_for_xp(rank_clans.xp + 250),
      updated_at = now()
  WHERE id = _clan_id;

  RETURN QUERY SELECT _clan.id, _player.id, _clan.tag;
END;
$$;

REVOKE ALL ON FUNCTION public.join_rank_clan_admin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_rank_clan_admin(uuid, uuid, text) TO service_role;