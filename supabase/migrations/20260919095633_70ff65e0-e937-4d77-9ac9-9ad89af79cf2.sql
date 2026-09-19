CREATE UNIQUE INDEX IF NOT EXISTS rank_players_user_id_unique
  ON public.rank_players (user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rank_clan_members_player_unique
  ON public.rank_clan_members (player_id);

CREATE OR REPLACE FUNCTION public.join_rank_clan(_clan_id uuid, _wallet text)
RETURNS TABLE (clan_id uuid, player_id uuid, clan_tag text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid := auth.uid();
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

  SELECT * INTO _clan
  FROM public.rank_clans
  WHERE id = _clan_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLAN NOT FOUND';
  END IF;

  SELECT * INTO _player
  FROM public.rank_players
  WHERE user_id = _user_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO _player
    FROM public.rank_players
    WHERE lower(wallet) = lower(_wallet) AND user_id IS NULL
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.rank_players
      SET user_id = _user_id, wallet = _wallet, updated_at = now()
      WHERE id = _player.id
      RETURNING * INTO _player;
    ELSE
      _name := 'WANDERER_' || upper(substr(md5(_user_id::text), 1, 8));
      INSERT INTO public.rank_players (user_id, wallet, name, title)
      VALUES (_user_id, _wallet, _name, 'Novice')
      RETURNING * INTO _player;
    END IF;
  END IF;

  IF _player.clan_id = _clan_id THEN
    RETURN QUERY SELECT _clan.id, _player.id, _clan.tag;
    RETURN;
  END IF;

  IF _player.clan_id IS NOT NULL THEN
    RAISE EXCEPTION 'LEAVE YOUR CURRENT CLAN BEFORE JOINING ANOTHER';
  END IF;

  SELECT count(*)::integer INTO _member_count
  FROM public.rank_clan_members
  WHERE rank_clan_members.clan_id = _clan_id;

  IF _member_count >= 36 THEN
    RAISE EXCEPTION 'THIS CLAN IS FULL';
  END IF;

  INSERT INTO public.rank_clan_members (clan_id, player_id, rank)
  VALUES (_clan_id, _player.id, 'member');

  UPDATE public.rank_players
  SET clan_id = _clan_id, updated_at = now()
  WHERE id = _player.id;

  UPDATE public.rank_clans
  SET members_count = (
    SELECT count(*)::integer
    FROM public.rank_clan_members
    WHERE rank_clan_members.clan_id = _clan_id
  ), updated_at = now()
  WHERE id = _clan_id;

  RETURN QUERY SELECT _clan.id, _player.id, _clan.tag;
END;
$$;

REVOKE ALL ON FUNCTION public.join_rank_clan(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_rank_clan(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_rank_clan(uuid, text) TO service_role;