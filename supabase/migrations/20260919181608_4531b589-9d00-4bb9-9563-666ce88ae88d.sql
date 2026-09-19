-- ============================ player share market =========================

CREATE TABLE public.player_stock (
  player_id uuid PRIMARY KEY REFERENCES public.rank_players(id) ON DELETE CASCADE,
  shares_issued bigint NOT NULL DEFAULT 0,
  bit_raised bigint NOT NULL DEFAULT 0,
  dividends_paid bigint NOT NULL DEFAULT 0,
  last_price bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_stock TO anon, authenticated;
GRANT ALL ON public.player_stock TO service_role;
ALTER TABLE public.player_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Share market is public" ON public.player_stock FOR SELECT USING (true);

CREATE TABLE public.player_share_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.rank_players(id) ON DELETE CASCADE,
  holder_address text NOT NULL,
  shares bigint NOT NULL DEFAULT 0,
  cost_basis bigint NOT NULL DEFAULT 0,
  dividends_earned bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, holder_address)
);
GRANT SELECT ON public.player_share_holdings TO anon, authenticated;
GRANT ALL ON public.player_share_holdings TO service_role;
ALTER TABLE public.player_share_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Holder register is public" ON public.player_share_holdings FOR SELECT USING (true);
CREATE INDEX player_share_holdings_player_idx ON public.player_share_holdings(player_id, shares DESC);
CREATE INDEX player_share_holdings_address_idx ON public.player_share_holdings(holder_address);

CREATE TABLE public.player_share_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.rank_players(id) ON DELETE CASCADE,
  address text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  shares bigint NOT NULL CHECK (shares > 0),
  unit_price bigint NOT NULL,
  total_coins bigint NOT NULL,
  shares_issued_after bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_share_trades TO anon, authenticated;
GRANT ALL ON public.player_share_trades TO service_role;
ALTER TABLE public.player_share_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Share trades are public" ON public.player_share_trades FOR SELECT USING (true);
CREATE INDEX player_share_trades_player_idx ON public.player_share_trades(player_id, created_at DESC);

CREATE TABLE public.player_share_dividends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.rank_players(id) ON DELETE CASCADE,
  total_coins bigint NOT NULL,
  holders integer NOT NULL,
  shares_issued bigint NOT NULL,
  source_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.player_share_dividends TO anon, authenticated;
GRANT ALL ON public.player_share_dividends TO service_role;
ALTER TABLE public.player_share_dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dividend log is public" ON public.player_share_dividends FOR SELECT USING (true);
CREATE INDEX player_share_dividends_player_idx ON public.player_share_dividends(player_id, created_at DESC);

CREATE TRIGGER player_stock_touch BEFORE UPDATE ON public.player_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER player_share_holdings_touch BEFORE UPDATE ON public.player_share_holdings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------- pricing ----

CREATE OR REPLACE FUNCTION public.player_share_base_value(_player_id uuid)
RETURNS bigint LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT GREATEST(
    25,
    floor(
      p.level * 30
      + p.fame::numeric / 12
      + p.pvp_kills * 15
      + p.pk_kills * 5
      + p.builds_maintained * 25
      + p.districts_visited * 3
      + p.bit_earned::numeric / 250
    )::bigint
  )
  FROM public.rank_players p
  WHERE p.id = _player_id
$$;

CREATE OR REPLACE FUNCTION public.player_share_price(_base bigint, _issued bigint)
RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT GREATEST(1, round(_base * LEAST(4.0, 1 + GREATEST(_issued, 0)::numeric * 0.01))::bigint)
$$;

-- --------------------------------------------------------------- trading --

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

  SELECT wallet INTO v_wallet FROM public.rank_players WHERE id = _player_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such player'; END IF;

  INSERT INTO public.player_stock (player_id) VALUES (_player_id)
  ON CONFLICT (player_id) DO NOTHING;

  SELECT shares_issued INTO v_issued FROM public.player_stock
   WHERE player_id = _player_id FOR UPDATE;

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

    UPDATE public.player_stock
       SET shares_issued = v_issued,
           bit_raised = bit_raised + v_total,
           last_price = public.player_share_price(v_base, v_issued),
           updated_at = now()
     WHERE player_id = _player_id;
  ELSE
    SELECT shares INTO v_held FROM public.player_share_holdings
     WHERE player_id = _player_id AND holder_address = _address FOR UPDATE;
    IF coalesce(v_held, 0) < _shares THEN RAISE EXCEPTION 'you do not hold that many shares'; END IF;

    FOR v_i IN 1.._shares LOOP
      v_total := v_total + GREATEST(1, floor(public.player_share_price(v_base, v_issued - v_i) * 0.9)::bigint);
      v_filled := v_filled + 1;
    END LOOP;
    v_issued := GREATEST(0, v_issued - v_filled);

    UPDATE public.player_share_holdings
       SET shares = shares - v_filled,
           cost_basis = GREATEST(0, cost_basis - (cost_basis * v_filled) / GREATEST(v_held, 1)),
           updated_at = now()
     WHERE player_id = _player_id AND holder_address = _address;

    PERFORM public.coin_apply(_address, v_total, 'shares_sell', _player_id::text);

    UPDATE public.player_stock
       SET shares_issued = v_issued,
           last_price = public.player_share_price(v_base, v_issued),
           updated_at = now()
     WHERE player_id = _player_id;
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

-- ------------------------------------------------------------ dividends --

CREATE OR REPLACE FUNCTION public.player_stock_pay_dividend(
  _player_id uuid,
  _amount bigint,
  _source text
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_issued bigint;
  v_wallet text;
  v_paid bigint := 0;
  v_holders integer := 0;
  v_cut bigint;
  r RECORD;
BEGIN
  IF _amount < 1 THEN RETURN 0; END IF;
  SELECT wallet INTO v_wallet FROM public.rank_players WHERE id = _player_id;
  IF v_wallet IS NULL THEN RETURN 0; END IF;
  SELECT shares_issued INTO v_issued FROM public.player_stock WHERE player_id = _player_id;
  IF coalesce(v_issued, 0) <= 0 THEN RETURN 0; END IF;

  FOR r IN
    SELECT holder_address, shares FROM public.player_share_holdings
     WHERE player_id = _player_id AND shares > 0
  LOOP
    v_cut := floor(_amount::numeric * r.shares / v_issued)::bigint;
    IF v_cut >= 1 AND lower(r.holder_address) <> lower(v_wallet) THEN
      PERFORM public.coin_apply(r.holder_address, v_cut, 'dividend_share', _player_id::text);
      UPDATE public.player_share_holdings
         SET dividends_earned = dividends_earned + v_cut, updated_at = now()
       WHERE player_id = _player_id AND holder_address = r.holder_address;
      v_paid := v_paid + v_cut;
      v_holders := v_holders + 1;
    END IF;
  END LOOP;

  IF v_paid <= 0 THEN RETURN 0; END IF;

  PERFORM public.coin_apply(v_wallet, -v_paid, 'dividend_paid', _player_id::text);

  UPDATE public.player_stock
     SET dividends_paid = dividends_paid + v_paid, updated_at = now()
   WHERE player_id = _player_id;

  INSERT INTO public.player_share_dividends
    (player_id, total_coins, holders, shares_issued, source_reason)
  VALUES (_player_id, v_paid, v_holders, v_issued, _source);

  RETURN v_paid;
END;
$$;

REVOKE ALL ON FUNCTION public.player_stock_pay_dividend(uuid, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_stock_pay_dividend(uuid, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.player_stock_dividend_hook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_player uuid;
  v_cut bigint;
BEGIN
  IF NEW.delta <= 0 THEN RETURN NEW; END IF;
  IF NEW.reason LIKE 'dividend%' OR NEW.reason LIKE 'shares_%' THEN RETURN NEW; END IF;

  SELECT id INTO v_player FROM public.rank_players
   WHERE wallet IS NOT NULL AND lower(wallet) = lower(NEW.address)
   LIMIT 1;
  IF v_player IS NULL THEN RETURN NEW; END IF;

  v_cut := floor(NEW.delta::numeric * 0.10)::bigint;
  IF v_cut < 1 THEN RETURN NEW; END IF;

  BEGIN
    PERFORM public.player_stock_pay_dividend(v_player, v_cut, NEW.reason);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER player_stock_dividend_after_ledger
AFTER INSERT ON public.coin_ledger
FOR EACH ROW EXECUTE FUNCTION public.player_stock_dividend_hook();
