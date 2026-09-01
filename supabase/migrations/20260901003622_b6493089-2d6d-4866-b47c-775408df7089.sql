-- 1. Coin balances
CREATE TABLE public.coin_balances (
  address text PRIMARY KEY,
  balance bigint NOT NULL DEFAULT 0,
  earned_total bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_balances TO anon, authenticated;
GRANT ALL ON public.coin_balances TO service_role;
ALTER TABLE public.coin_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_balances_public_read ON public.coin_balances FOR SELECT USING (true);

-- 2. Coin ledger
CREATE TABLE public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  delta bigint NOT NULL,
  reason text NOT NULL,
  ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coin_ledger_address_idx ON public.coin_ledger (address, created_at DESC);
GRANT SELECT ON public.coin_ledger TO anon, authenticated;
GRANT ALL ON public.coin_ledger TO service_role;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_ledger_public_read ON public.coin_ledger FOR SELECT USING (true);

-- 3. Reward bookkeeping
CREATE TABLE public.coin_reward_runs (
  run_date date PRIMARY KEY,
  awarded bigint NOT NULL DEFAULT 0,
  recipients integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_reward_runs TO anon, authenticated;
GRANT ALL ON public.coin_reward_runs TO service_role;
ALTER TABLE public.coin_reward_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_reward_runs_public_read ON public.coin_reward_runs FOR SELECT USING (true);

CREATE TABLE public.coin_view_snapshots (
  bitmap_height bigint PRIMARY KEY,
  total_views bigint NOT NULL DEFAULT 0,
  unique_visitors bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coin_view_snapshots TO anon, authenticated;
GRANT ALL ON public.coin_view_snapshots TO service_role;
ALTER TABLE public.coin_view_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_view_snapshots_public_read ON public.coin_view_snapshots FOR SELECT USING (true);

-- 4. Builder events (raffles, giveaways, events)
CREATE TABLE public.coin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'raffle',
  bitmap_height bigint,
  host_address text NOT NULL,
  title text NOT NULL,
  description text,
  prize text,
  entry_cost bigint NOT NULL DEFAULT 0,
  max_entries integer,
  status text NOT NULL DEFAULT 'open',
  ends_at timestamptz,
  winner_address text,
  drawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coin_events_host_idx ON public.coin_events (host_address);
CREATE INDEX coin_events_bitmap_idx ON public.coin_events (bitmap_height);
GRANT SELECT, INSERT, UPDATE ON public.coin_events TO authenticated;
GRANT SELECT ON public.coin_events TO anon;
GRANT ALL ON public.coin_events TO service_role;
ALTER TABLE public.coin_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_events_public_read ON public.coin_events FOR SELECT USING (true);
CREATE POLICY coin_events_host_insert ON public.coin_events FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), host_address));
CREATE POLICY coin_events_host_update ON public.coin_events FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), host_address))
  WITH CHECK (public.owns_wallet(auth.uid(), host_address));

CREATE TABLE public.coin_event_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.coin_events(id) ON DELETE CASCADE,
  address text NOT NULL,
  tickets integer NOT NULL DEFAULT 1,
  spent bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coin_event_entries_event_idx ON public.coin_event_entries (event_id);
GRANT SELECT ON public.coin_event_entries TO anon, authenticated;
GRANT ALL ON public.coin_event_entries TO service_role;
ALTER TABLE public.coin_event_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY coin_event_entries_public_read ON public.coin_event_entries FOR SELECT USING (true);

CREATE TRIGGER coin_events_updated_at BEFORE UPDATE ON public.coin_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_coin_event()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind NOT IN ('raffle', 'giveaway', 'event') THEN
    RAISE EXCEPTION 'invalid event kind: %', NEW.kind;
  END IF;
  IF NEW.status NOT IN ('open', 'drawn', 'closed') THEN
    RAISE EXCEPTION 'invalid event status: %', NEW.status;
  END IF;
  IF NEW.entry_cost < 0 THEN
    RAISE EXCEPTION 'entry cost cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_coin_event_trigger BEFORE INSERT OR UPDATE ON public.coin_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_coin_event();

-- 5. Coin-denominated off-chain leases
ALTER TABLE public.lease_offers
  ADD COLUMN rate_coins_per_day bigint NOT NULL DEFAULT 0,
  ALTER COLUMN rate_sats_per_day SET DEFAULT 0;
ALTER TABLE public.leases
  ADD COLUMN rate_coins_per_day bigint NOT NULL DEFAULT 0,
  ADD COLUMN total_coins bigint NOT NULL DEFAULT 0,
  ALTER COLUMN rate_sats_per_day SET DEFAULT 0,
  ALTER COLUMN total_sats SET DEFAULT 0,
  ALTER COLUMN fee_sats SET DEFAULT 0;

-- 6. Coin movement primitives (platform only)
CREATE OR REPLACE FUNCTION public.coin_apply(_address text, _delta bigint, _reason text, _ref text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_balance bigint;
BEGIN
  IF _address IS NULL OR length(_address) < 10 THEN
    RAISE EXCEPTION 'invalid coin address';
  END IF;
  INSERT INTO public.coin_balances (address, balance, earned_total)
  VALUES (_address, 0, 0)
  ON CONFLICT (address) DO NOTHING;

  UPDATE public.coin_balances
     SET balance = balance + _delta,
         earned_total = earned_total + GREATEST(_delta, 0),
         updated_at = now()
   WHERE address = _address
  RETURNING balance INTO new_balance;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient BIT balance';
  END IF;

  INSERT INTO public.coin_ledger (address, delta, reason, ref)
  VALUES (_address, _delta, _reason, _ref);

  RETURN new_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_apply(text, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_apply(text, bigint, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.coin_enter_event(_event_id uuid, _address text, _tickets integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.coin_events;
  used integer;
  cost bigint;
  entry_id uuid;
BEGIN
  SELECT * INTO ev FROM public.coin_events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
  IF ev.status <> 'open' THEN RAISE EXCEPTION 'this event is closed'; END IF;
  IF ev.ends_at IS NOT NULL AND ev.ends_at <= now() THEN RAISE EXCEPTION 'this event has ended'; END IF;
  IF _tickets < 1 OR _tickets > 1000 THEN RAISE EXCEPTION 'invalid ticket count'; END IF;
  IF lower(ev.host_address) = lower(_address) THEN RAISE EXCEPTION 'the host cannot enter their own event'; END IF;

  SELECT coalesce(sum(tickets), 0) INTO used FROM public.coin_event_entries WHERE event_id = _event_id;
  IF ev.max_entries IS NOT NULL AND used + _tickets > ev.max_entries THEN
    RAISE EXCEPTION 'only % ticket(s) left', ev.max_entries - used;
  END IF;

  cost := ev.entry_cost * _tickets;
  IF cost > 0 THEN
    PERFORM public.coin_apply(_address, -cost, 'event_entry', _event_id::text);
    PERFORM public.coin_apply(ev.host_address, cost, 'event_revenue', _event_id::text);
  END IF;

  INSERT INTO public.coin_event_entries (event_id, address, tickets, spent)
  VALUES (_event_id, _address, _tickets, cost)
  RETURNING id INTO entry_id;

  RETURN entry_id;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_enter_event(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_enter_event(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.coin_draw_event(_event_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.coin_events;
  winner text;
BEGIN
  SELECT * INTO ev FROM public.coin_events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
  IF ev.status <> 'open' THEN RAISE EXCEPTION 'this event is already settled'; END IF;

  SELECT address INTO winner
  FROM public.coin_event_entries e, generate_series(1, e.tickets)
  WHERE e.event_id = _event_id
  ORDER BY random()
  LIMIT 1;

  IF winner IS NULL THEN RAISE EXCEPTION 'no entries to draw from'; END IF;

  UPDATE public.coin_events
     SET status = 'drawn', winner_address = winner, drawn_at = now()
   WHERE id = _event_id;

  RETURN winner;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_draw_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_draw_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.coin_start_lease(
  _offer_id uuid, _lessee_address text, _days integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.lease_offers;
  total bigint;
  lease_id uuid;
BEGIN
  SELECT * INTO o FROM public.lease_offers WHERE id = _offer_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'lease offer not found'; END IF;
  IF o.status <> 'open' THEN RAISE EXCEPTION 'this bitmap is no longer offered for lease'; END IF;
  IF _days < o.min_days OR _days > o.max_days THEN
    RAISE EXCEPTION 'lease length must be between % and % days', o.min_days, o.max_days;
  END IF;
  IF lower(o.owner_address) = lower(_lessee_address) THEN
    RAISE EXCEPTION 'you already hold this bitmap';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.leases
    WHERE bitmap_height = o.bitmap_height AND status = 'active' AND ends_at > now()
  ) THEN
    RAISE EXCEPTION 'this bitmap is already leased';
  END IF;

  total := o.rate_coins_per_day * _days;
  IF total <= 0 THEN RAISE EXCEPTION 'lease rate must be at least 1 BIT per day'; END IF;

  PERFORM public.coin_apply(_lessee_address, -total, 'lease_rent_paid', o.bitmap_height::text);
  PERFORM public.coin_apply(o.owner_address, total, 'lease_rent_earned', o.bitmap_height::text);

  INSERT INTO public.leases (
    bitmap_height, owner_address, lessee_address, rate_coins_per_day, total_coins,
    days, status, starts_at, ends_at
  ) VALUES (
    o.bitmap_height, o.owner_address, _lessee_address, o.rate_coins_per_day, total,
    _days, 'active', now(), now() + (_days || ' days')::interval
  ) RETURNING id INTO lease_id;

  INSERT INTO public.activity (type, wallet_address, metadata)
  VALUES ('lease', _lessee_address, jsonb_build_object(
    'bitmap_height', o.bitmap_height,
    'owner_address', o.owner_address,
    'days', _days,
    'rent_coins', total
  ));

  RETURN lease_id;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_start_lease(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_start_lease(uuid, text, integer) TO service_role;