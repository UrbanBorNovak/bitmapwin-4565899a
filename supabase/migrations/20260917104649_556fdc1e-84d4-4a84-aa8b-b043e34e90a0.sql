CREATE TABLE public.market_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id text NOT NULL REFERENCES public.goods_market(item_id),
  seller_address text NOT NULL,
  seller_kind text NOT NULL DEFAULT 'player',
  seller_name text NOT NULL DEFAULT 'PLAYER',
  quantity integer NOT NULL,
  filled integer NOT NULL DEFAULT 0,
  unit_price bigint NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT market_listings_kind_check CHECK (seller_kind IN ('player','npc')),
  CONSTRAINT market_listings_status_check CHECK (status IN ('open','sold','cancelled','expired')),
  CONSTRAINT market_listings_qty_check CHECK (quantity > 0 AND quantity <= 500 AND filled >= 0 AND filled <= quantity),
  CONSTRAINT market_listings_price_check CHECK (unit_price > 0 AND unit_price <= 10000000)
);

CREATE INDEX market_listings_open_idx ON public.market_listings (status, created_at DESC);
CREATE INDEX market_listings_seller_idx ON public.market_listings (seller_address);

GRANT SELECT ON public.market_listings TO anon;
GRANT SELECT ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market listings are public" ON public.market_listings
  FOR SELECT USING (true);

CREATE TRIGGER market_listings_touch
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- keeps the settler round from being run more than once a minute
CREATE TABLE public.market_npc_state (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  last_run timestamp with time zone NOT NULL DEFAULT now() - interval '1 hour',
  listed_total bigint NOT NULL DEFAULT 0,
  bought_total bigint NOT NULL DEFAULT 0,
  CONSTRAINT market_npc_state_single CHECK (id)
);
INSERT INTO public.market_npc_state (id) VALUES (true);

GRANT SELECT ON public.market_npc_state TO anon;
GRANT SELECT ON public.market_npc_state TO authenticated;
GRANT ALL ON public.market_npc_state TO service_role;

ALTER TABLE public.market_npc_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market npc state is public" ON public.market_npc_state
  FOR SELECT USING (true);

-- A player puts goods on the board.
CREATE OR REPLACE FUNCTION public.market_list_goods(
  _address text,
  _item text,
  _qty integer,
  _unit_price bigint
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _open integer;
  _id uuid;
BEGIN
  IF _address IS NULL OR length(_address) < 16 THEN
    RAISE EXCEPTION 'bad address';
  END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 500 THEN
    RAISE EXCEPTION 'bad quantity';
  END IF;
  IF _unit_price IS NULL OR _unit_price < 1 OR _unit_price > 10000000 THEN
    RAISE EXCEPTION 'bad price';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.goods_market WHERE item_id = _item) THEN
    RAISE EXCEPTION 'unknown item';
  END IF;

  SELECT count(*) INTO _open
  FROM public.market_listings
  WHERE seller_address = _address AND status = 'open';
  IF _open >= 12 THEN
    RAISE EXCEPTION 'too many open listings';
  END IF;

  INSERT INTO public.market_listings (item_id, seller_address, seller_kind, seller_name, quantity, unit_price)
  VALUES (_item, _address, 'player', 'PLAYER', _qty, _unit_price)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

-- A buyer takes goods off a listing; BIT moves from buyer to seller.
CREATE OR REPLACE FUNCTION public.market_buy_listing(
  _buyer_address text,
  _listing_id uuid,
  _qty integer
) RETURNS TABLE(filled integer, unit_price bigint, total_coins bigint, item_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.market_listings;
  _take integer;
  _total bigint;
BEGIN
  IF _buyer_address IS NULL OR length(_buyer_address) < 16 THEN
    RAISE EXCEPTION 'bad address';
  END IF;
  IF _qty IS NULL OR _qty < 1 OR _qty > 500 THEN
    RAISE EXCEPTION 'bad quantity';
  END IF;

  SELECT * INTO _row FROM public.market_listings WHERE id = _listing_id FOR UPDATE;
  IF _row.id IS NULL OR _row.status <> 'open' THEN
    RAISE EXCEPTION 'listing closed';
  END IF;
  IF _row.seller_address = _buyer_address THEN
    RAISE EXCEPTION 'cannot buy your own listing';
  END IF;

  _take := least(_qty, _row.quantity - _row.filled);
  IF _take < 1 THEN
    RAISE EXCEPTION 'listing closed';
  END IF;
  _total := _take::bigint * _row.unit_price;

  PERFORM public.coin_spend(_buyer_address, _total::integer, 'market-buy', _row.id::text);

  IF _row.seller_kind = 'player' THEN
    PERFORM public.coin_apply(_row.seller_address, _total, 'market-sale', _row.id::text);
  END IF;

  UPDATE public.market_listings
  SET filled = _row.filled + _take,
      status = CASE WHEN _row.filled + _take >= _row.quantity THEN 'sold' ELSE 'open' END
  WHERE id = _row.id;

  INSERT INTO public.goods_trades (item_id, address, side, quantity, unit_price, total_coins)
  VALUES (_row.item_id, _buyer_address, 'buy', _take, _row.unit_price, _total);

  RETURN QUERY SELECT _take, _row.unit_price, _total, _row.item_id;
END;
$$;

-- A seller pulls their own listing back off the board.
CREATE OR REPLACE FUNCTION public.market_cancel_listing(
  _address text,
  _listing_id uuid
) RETURNS TABLE(item_id text, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.market_listings;
BEGIN
  SELECT * INTO _row FROM public.market_listings WHERE id = _listing_id FOR UPDATE;
  IF _row.id IS NULL OR _row.status <> 'open' THEN
    RAISE EXCEPTION 'listing closed';
  END IF;
  IF _row.seller_address <> _address OR _row.seller_kind <> 'player' THEN
    RAISE EXCEPTION 'not your listing';
  END IF;

  UPDATE public.market_listings SET status = 'cancelled' WHERE id = _row.id;
  RETURN QUERY SELECT _row.item_id, _row.quantity - _row.filled;
END;
$$;

-- One round of settler trading: they post their own goods and buy up
-- fairly-priced player listings. Rate limited to once a minute.
CREATE OR REPLACE FUNCTION public.market_npc_tick()
RETURNS TABLE(listed integer, bought integer, skipped boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _last timestamp with time zone;
  _listed integer := 0;
  _bought integer := 0;
  _names text[] := ARRAY['ASH OFTHESAND','MERI GRIT','DUNE MK2','KOVA HOLLOW','SILT DRIFT','RENN STONE','ORRA OASIS','TAMB-9'];
  _good record;
  _listing record;
  _price bigint;
  _qty integer;
  _take integer;
  _total bigint;
  _fair bigint;
BEGIN
  SELECT last_run INTO _last FROM public.market_npc_state WHERE id LIMIT 1 FOR UPDATE;
  IF _last > now() - interval '1 minute' THEN
    RETURN QUERY SELECT 0, 0, true;
    RETURN;
  END IF;

  UPDATE public.market_npc_state SET last_run = now() WHERE id;

  -- settlers retire their stale stock
  UPDATE public.market_listings
  SET status = 'expired'
  WHERE status = 'open' AND seller_kind = 'npc' AND created_at < now() - interval '2 hours';

  -- settlers post fresh stock, priced around the live market rate
  FOR _good IN
    SELECT item_id, base_price, baseline_stock, stock
    FROM public.goods_market
    ORDER BY random()
    LIMIT 3
  LOOP
    _price := greatest(
      1,
      round(public.goods_price(_good.base_price, _good.baseline_stock, _good.stock) * (0.85 + random() * 0.35))
    );
    _qty := 1 + floor(random() * 6)::integer;
    INSERT INTO public.market_listings (item_id, seller_address, seller_kind, seller_name, quantity, unit_price)
    VALUES (
      _good.item_id,
      'oasis-settler-' || _good.item_id,
      'npc',
      _names[1 + floor(random() * array_length(_names, 1))::integer],
      _qty,
      _price
    );
    _listed := _listed + 1;
  END LOOP;

  -- settlers buy up player stock offered at or under the market rate
  FOR _listing IN
    SELECT l.id, l.item_id, l.seller_address, l.unit_price, l.quantity, l.filled,
           public.goods_price(g.base_price, g.baseline_stock, g.stock) AS market_price
    FROM public.market_listings l
    JOIN public.goods_market g ON g.item_id = l.item_id
    WHERE l.status = 'open' AND l.seller_kind = 'player'
    ORDER BY l.created_at
    LIMIT 4
    FOR UPDATE OF l
  LOOP
    _fair := _listing.market_price;
    IF _listing.unit_price > _fair THEN
      CONTINUE;
    END IF;
    _take := least(_listing.quantity - _listing.filled, 1 + floor(random() * 4)::integer);
    IF _take < 1 THEN
      CONTINUE;
    END IF;
    _total := _take::bigint * _listing.unit_price;

    PERFORM public.coin_apply(_listing.seller_address, _total, 'market-sale', _listing.id::text);

    UPDATE public.market_listings
    SET filled = _listing.filled + _take,
        status = CASE WHEN _listing.filled + _take >= _listing.quantity THEN 'sold' ELSE 'open' END
    WHERE id = _listing.id;

    INSERT INTO public.goods_trades (item_id, address, side, quantity, unit_price, total_coins)
    VALUES (_listing.item_id, 'oasis-settler', 'buy', _take, _listing.unit_price, _total);

    _bought := _bought + 1;
  END LOOP;

  UPDATE public.market_npc_state
  SET listed_total = listed_total + _listed,
      bought_total = bought_total + _bought
  WHERE id;

  RETURN QUERY SELECT _listed, _bought, false;
END;
$$;

REVOKE ALL ON FUNCTION public.market_list_goods(text, text, integer, bigint) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.market_buy_listing(text, uuid, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.market_cancel_listing(text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.market_npc_tick() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_list_goods(text, text, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_buy_listing(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_cancel_listing(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_npc_tick() TO service_role;