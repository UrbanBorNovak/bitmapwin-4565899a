CREATE TABLE public.goods_market (
  item_id text PRIMARY KEY,
  base_price bigint NOT NULL CHECK (base_price > 0),
  baseline_stock bigint NOT NULL CHECK (baseline_stock > 0),
  stock bigint NOT NULL DEFAULT 0 CHECK (stock >= 0),
  bought_total bigint NOT NULL DEFAULT 0,
  sold_total bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.goods_market TO anon;
GRANT SELECT ON public.goods_market TO authenticated;
GRANT ALL ON public.goods_market TO service_role;
ALTER TABLE public.goods_market ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goods market prices are public" ON public.goods_market FOR SELECT USING (true);

CREATE TABLE public.goods_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL REFERENCES public.goods_market(item_id),
  address text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 500),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  total_coins bigint NOT NULL CHECK (total_coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX goods_trades_item_time ON public.goods_trades (item_id, created_at DESC);
GRANT SELECT ON public.goods_trades TO anon;
GRANT SELECT ON public.goods_trades TO authenticated;
GRANT ALL ON public.goods_trades TO service_role;
ALTER TABLE public.goods_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goods trades are public" ON public.goods_trades FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.goods_price(_base bigint, _baseline bigint, _stock bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(1, round(
    _base * LEAST(4.0, GREATEST(0.3,
      power(GREATEST(_baseline, 1)::numeric / GREATEST(_stock, 1)::numeric, 0.6)
    ))
  ))::bigint
$$;

CREATE OR REPLACE FUNCTION public.goods_trade(_address text, _item text, _side text, _qty integer)
RETURNS TABLE(filled integer, unit_price bigint, total_coins bigint, stock bigint, price bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_market public.goods_market;
  moved integer := 0;
  gross bigint := 0;
  step bigint;
  working bigint;
BEGIN
  IF _address IS NULL OR length(_address) < 10 THEN
    RAISE EXCEPTION 'invalid address';
  END IF;
  IF _side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'invalid trade side';
  END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 500 THEN
    RAISE EXCEPTION 'invalid quantity';
  END IF;

  SELECT * INTO row_market FROM public.goods_market WHERE item_id = _item FOR UPDATE;
  IF row_market.item_id IS NULL THEN
    RAISE EXCEPTION 'this item is not traded here';
  END IF;

  working := row_market.stock;

  WHILE moved < _qty LOOP
    IF _side = 'buy' THEN
      IF working <= 0 THEN EXIT; END IF;
      step := public.goods_price(row_market.base_price, row_market.baseline_stock, working);
      working := working - 1;
    ELSE
      step := GREATEST(1, round(public.goods_price(row_market.base_price, row_market.baseline_stock, working + 1) * 0.78))::bigint;
      working := working + 1;
    END IF;
    gross := gross + step;
    moved := moved + 1;
  END LOOP;

  IF moved = 0 THEN
    RAISE EXCEPTION 'the market is out of stock';
  END IF;

  IF _side = 'buy' THEN
    PERFORM public.coin_apply(_address, -gross, 'goods_bought', _item);
    UPDATE public.goods_market
       SET stock = working,
           sold_total = sold_total + moved,
           updated_at = now()
     WHERE item_id = _item
    RETURNING * INTO row_market;
  ELSE
    PERFORM public.coin_apply(_address, gross, 'goods_sold', _item);
    UPDATE public.goods_market
       SET stock = working,
           bought_total = bought_total + moved,
           updated_at = now()
     WHERE item_id = _item
    RETURNING * INTO row_market;
  END IF;

  INSERT INTO public.goods_trades (item_id, address, side, quantity, unit_price, total_coins)
  VALUES (_item, _address, _side, moved, (gross / moved)::bigint, gross);

  RETURN QUERY SELECT moved,
                      (gross / moved)::bigint,
                      gross,
                      row_market.stock,
                      public.goods_price(row_market.base_price, row_market.baseline_stock, row_market.stock);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.goods_trade(text, text, text, integer) FROM anon, authenticated;

INSERT INTO public.goods_market (item_id, base_price, baseline_stock, stock) VALUES
  ('ore-chunk', 18, 4000, 4000),
  ('mineral', 26, 2500, 2500),
  ('gold-nugget', 45, 1800, 1800),
  ('gold-bar', 220, 400, 400),
  ('hide', 30, 1200, 1200),
  ('fang', 55, 700, 700),
  ('key', 90, 300, 300),
  ('relic', 600, 60, 60);