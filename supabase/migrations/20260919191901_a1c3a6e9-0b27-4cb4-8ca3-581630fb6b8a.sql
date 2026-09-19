ALTER TABLE public.player_stock
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shares_offered bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS owner_address text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS fees_paid bigint NOT NULL DEFAULT 0;

ALTER TABLE public.player_share_trades
  ADD COLUMN IF NOT EXISTS fee_coins bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.player_stock_issue(_address text, _player_id uuid, _shares_offered integer)
 RETURNS TABLE(is_open boolean, shares_offered bigint, shares_issued bigint, fee_coins bigint, price bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet text;
  v_open boolean;
  v_offered bigint;
  v_issued bigint;
  v_fee bigint;
  v_base bigint;
BEGIN
  IF _shares_offered < 1 OR _shares_offered > 5000 THEN RAISE EXCEPTION 'offer between 1 and 5000 shares'; END IF;

  SELECT p.wallet INTO v_wallet FROM public.rank_players p WHERE p.id = _player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such player'; END IF;
  IF v_wallet IS NULL THEN
    UPDATE public.rank_players SET wallet = _address WHERE id = _player_id AND wallet IS NULL;
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

GRANT EXECUTE ON FUNCTION public.player_stock_issue(text, uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.player_stock_trade(_address text, _player_id uuid, _side text, _shares integer)
 RETURNS TABLE(filled integer, unit_price bigint, total_coins bigint, price bigint, shares_issued bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_base bigint;
  v_issued bigint;
  v_held bigint;
  v_i integer;
  v_total bigint := 0;
  v_unit bigint;
  v_fee bigint := 0;
  v_charged bigint;
  v_filled integer := 0;
  v_wallet text;
  v_open boolean;
  v_offered bigint;
  v_owner text;
BEGIN
  IF _shares < 1 OR _shares > 500 THEN RAISE EXCEPTION 'invalid share count'; END IF;
  IF _side NOT IN ('buy', 'sell') THEN RAISE EXCEPTION 'invalid side'; END IF;

  SELECT p.wallet INTO v_wallet FROM public.rank_players p WHERE p.id = _player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such player'; END IF;

  INSERT INTO public.player_stock (player_id) VALUES (_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  SELECT s.shares_issued, s.is_open, s.shares_offered, s.owner_address
    INTO v_issued, v_open, v_offered, v_owner
    FROM public.player_stock s WHERE s.player_id = _player_id FOR UPDATE;

  v_base := public.player_share_base_value(_player_id);

  IF _side = 'buy' THEN
    IF NOT v_open THEN RAISE EXCEPTION 'this share book is not open yet'; END IF;
    IF v_issued + _shares > v_offered THEN
      RAISE EXCEPTION 'only % shares remain on offer', GREATEST(0, v_offered - v_issued);
    END IF;

    FOR v_i IN 0.._shares - 1 LOOP
      v_total := v_total + public.player_share_price(v_base, v_issued + v_i);
      v_filled := v_filled + 1;
    END LOOP;
    v_fee := GREATEST(1, ceil(v_total * 200 / 10000.0)::bigint);
    v_charged := v_total + v_fee;

    PERFORM public.coin_apply(_address, -v_charged, 'shares_buy', _player_id::text);
    PERFORM public.coin_apply('bc1qmp0x47twrjududsj9txvdkvv9kmcl6r8u3eteq', v_fee, 'platform_fee_shares', _player_id::text);
    IF v_owner IS NOT NULL AND lower(v_owner) <> lower(_address) THEN
      PERFORM public.coin_apply(v_owner, v_total, 'shares_proceeds', _player_id::text);
    END IF;

    v_issued := v_issued + v_filled;

    INSERT INTO public.player_share_holdings (player_id, holder_address, shares, cost_basis)
    VALUES (_player_id, _address, v_filled, v_charged)
    ON CONFLICT (player_id, holder_address) DO UPDATE
      SET shares = public.player_share_holdings.shares + EXCLUDED.shares,
          cost_basis = public.player_share_holdings.cost_basis + EXCLUDED.cost_basis,
          updated_at = now();

    UPDATE public.player_stock s
       SET shares_issued = v_issued,
           bit_raised = s.bit_raised + v_total,
           last_price = public.player_share_price(v_base, v_issued),
           updated_at = now()
     WHERE s.player_id = _player_id;
  ELSE
    SELECT hh.shares INTO v_held FROM public.player_share_holdings hh
     WHERE hh.player_id = _player_id AND hh.holder_address = _address FOR UPDATE;
    IF coalesce(v_held, 0) < _shares THEN RAISE EXCEPTION 'you do not hold that many shares'; END IF;

    FOR v_i IN 1.._shares LOOP
      v_total := v_total + GREATEST(1, floor(public.player_share_price(v_base, v_issued - v_i) * 0.9)::bigint);
      v_filled := v_filled + 1;
    END LOOP;
    v_fee := GREATEST(1, ceil(v_total * 200 / 10000.0)::bigint);
    v_charged := GREATEST(0, v_total - v_fee);
    v_issued := GREATEST(0, v_issued - v_filled);

    UPDATE public.player_share_holdings hh
       SET shares = hh.shares - v_filled,
           cost_basis = GREATEST(0, hh.cost_basis - (hh.cost_basis * v_filled) / GREATEST(v_held, 1)),
           updated_at = now()
     WHERE hh.player_id = _player_id AND hh.holder_address = _address;

    PERFORM public.coin_apply(_address, v_charged, 'shares_sell', _player_id::text);
    PERFORM public.coin_apply('bc1qmp0x47twrjududsj9txvdkvv9kmcl6r8u3eteq', v_fee, 'platform_fee_shares', _player_id::text);

    UPDATE public.player_stock s
       SET shares_issued = v_issued,
           last_price = public.player_share_price(v_base, v_issued),
           updated_at = now()
     WHERE s.player_id = _player_id;
  END IF;

  v_unit := CASE WHEN v_filled > 0 THEN round(v_total::numeric / v_filled)::bigint ELSE 0 END;

  INSERT INTO public.player_share_trades
    (player_id, address, side, shares, unit_price, total_coins, shares_issued_after, fee_coins)
  VALUES (_player_id, _address, _side, v_filled, v_unit, v_charged, v_issued, v_fee);

  RETURN QUERY
  SELECT v_filled, v_unit, v_charged, public.player_share_price(v_base, v_issued), v_issued;
END;
$function$;
