-- Speed bounty: each joined session gets a secret token (only its hash is stored).
ALTER TABLE public.speed_bounty_sessions ADD COLUMN IF NOT EXISTS token_hash text;

-- Bids: status changes (accept/decline/cancel) go only through trusted server code.
DROP POLICY IF EXISTS "bidders update their own bids" ON public.bids;
REVOKE UPDATE ON public.bids FROM anon, authenticated;

-- Player shares: a character can only be linked to a wallet by its own account.
DROP FUNCTION IF EXISTS public.player_stock_issue(text, uuid, integer);
CREATE OR REPLACE FUNCTION public.player_stock_issue(_address text, _player_id uuid, _shares_offered integer, _user_id uuid)
 RETURNS TABLE(is_open boolean, shares_offered bigint, shares_issued bigint, fee_coins bigint, price bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet text;
  v_owner uuid;
  v_open boolean;
  v_offered bigint;
  v_issued bigint;
  v_fee bigint;
  v_base bigint;
BEGIN
  IF _shares_offered < 1 OR _shares_offered > 5000 THEN RAISE EXCEPTION 'offer between 1 and 5000 shares'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;

  SELECT p.wallet, p.user_id INTO v_wallet, v_owner FROM public.rank_players p WHERE p.id = _player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such player'; END IF;
  IF v_owner IS DISTINCT FROM _user_id THEN
    RAISE EXCEPTION 'this character does not belong to your account';
  END IF;
  IF v_wallet IS NULL THEN
    UPDATE public.rank_players SET wallet = _address WHERE id = _player_id AND wallet IS NULL AND user_id = _user_id;
  ELSIF lower(v_wallet) <> lower(_address) THEN
    RAISE EXCEPTION 'this character is not linked to your wallet';
  END IF;

  INSERT INTO public.player_stock (player_id) VALUES (_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  SELECT s.is_open, s.shares_offered, s.shares_issued
    INTO v_open, v_offered, v_issued
    FROM public.player_stock s WHERE s.player_id = _player_id FOR UPDATE;

  v_fee := CASE WHEN v_open THEN 50 ELSE 250 END;
  IF v_open AND _shares_offered <= v_offered THEN
    RAISE EXCEPTION 'your book already offers that many shares';
  END IF;

  PERFORM public.coin_apply(_address, -v_fee, 'shares_issue_fee', _player_id::text);
  PERFORM public.coin_apply('bc1qmp0x47twrjududsj9txvdkvv9kmcl6r8u3eteq', v_fee, 'platform_fee_shares', _player_id::text);

  v_base := public.player_share_base_value(_player_id);
  v_offered := GREATEST(v_offered, _shares_offered::bigint);

  UPDATE public.player_stock s
     SET is_open = true,
         shares_offered = v_offered,
         owner_address = _address,
         opened_at = COALESCE(s.opened_at, now()),
         fees_paid = s.fees_paid + v_fee,
         last_price = public.player_share_price(v_base, v_issued),
         updated_at = now()
   WHERE s.player_id = _player_id;

  RETURN QUERY SELECT true, v_offered, v_issued, v_fee, public.player_share_price(v_base, v_issued);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.player_stock_issue(text, uuid, integer, uuid) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_stock_issue(text, uuid, integer, uuid) TO service_role;