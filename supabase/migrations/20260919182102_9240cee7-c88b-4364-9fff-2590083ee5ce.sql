CREATE OR REPLACE FUNCTION public.player_stock_trade(
  _address text,
  _player_id uuid,
  _side text,
  _shares integer
)
RETURNS TABLE(filled integer, unit_price bigint, total_coins bigint, price bigint, shares_issued bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base bigint;
  v_issued bigint;
  v_held bigint;
  v_i integer;
  v_unit bigint;
  v_total bigint := 0;
  v_filled integer := 0;
  v_wallet text;
BEGIN
  IF _shares < 1 OR _shares > 500 THEN RAISE EXCEPTION 'invalid share count'; END IF;
  IF _side NOT IN ('buy', 'sell') THEN RAISE EXCEPTION 'invalid side'; END IF;

  SELECT p.wallet INTO v_wallet FROM public.rank_players p WHERE p.id = _player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such player'; END IF;

  INSERT INTO public.player_stock (player_id) VALUES (_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  SELECT s.shares_issued INTO v_issued FROM public.player_stock s
   WHERE s.player_id = _player_id FOR UPDATE;

  v_base := public.player_share_base_value(_player_id);

  IF _side = 'buy' THEN
    FOR v_i IN 0.._shares - 1 LOOP
      v_total := v_total + public.player_share_price(v_base, v_issued + v_i);
      v_filled := v_filled + 1;
    END LOOP;
    PERFORM public.coin_apply(_address, -v_total, 'shares_buy', _player_id::text);
    v_issued := v_issued + v_filled;

    INSERT INTO public.player_share_holdings (player_id, holder_address, shares, cost_basis)
    VALUES (_player_id, _address, v_filled, v_total)
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
    v_issued := GREATEST(0, v_issued - v_filled);

    UPDATE public.player_share_holdings hh
       SET shares = hh.shares - v_filled,
           cost_basis = GREATEST(0, hh.cost_basis - (hh.cost_basis * v_filled) / GREATEST(v_held, 1)),
           updated_at = now()
     WHERE hh.player_id = _player_id AND hh.holder_address = _address;

    PERFORM public.coin_apply(_address, v_total, 'shares_sell', _player_id::text);

    UPDATE public.player_stock s
       SET shares_issued = v_issued,
           last_price = public.player_share_price(v_base, v_issued),
           updated_at = now()
     WHERE s.player_id = _player_id;
  END IF;

  v_unit := CASE WHEN v_filled > 0 THEN round(v_total::numeric / v_filled)::bigint ELSE 0 END;

  INSERT INTO public.player_share_trades
    (player_id, address, side, shares, unit_price, total_coins, shares_issued_after)
  VALUES (_player_id, _address, _side, v_filled, v_unit, v_total, v_issued);

  RETURN QUERY
  SELECT v_filled, v_unit, v_total, public.player_share_price(v_base, v_issued), v_issued;
END;
$$;

REVOKE ALL ON FUNCTION public.player_stock_trade(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_stock_trade(text, uuid, text, integer) TO service_role;
