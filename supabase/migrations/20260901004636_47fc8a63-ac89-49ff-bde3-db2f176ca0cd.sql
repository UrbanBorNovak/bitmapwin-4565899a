ALTER TABLE public.coin_events
  ADD COLUMN prize_coins bigint NOT NULL DEFAULT 0,
  ADD COLUMN prize_paid_at timestamptz;

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
  IF NEW.prize_coins < 0 THEN
    RAISE EXCEPTION 'prize cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.coin_create_event(
  _kind text,
  _host_address text,
  _title text,
  _bitmap_height bigint DEFAULT NULL,
  _description text DEFAULT NULL,
  _prize text DEFAULT NULL,
  _prize_coins bigint DEFAULT 0,
  _entry_cost bigint DEFAULT 0,
  _max_entries integer DEFAULT NULL,
  _ends_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_id uuid;
BEGIN
  IF _prize_coins < 0 THEN RAISE EXCEPTION 'prize cannot be negative'; END IF;
  IF _entry_cost < 0 THEN RAISE EXCEPTION 'entry cost cannot be negative'; END IF;

  INSERT INTO public.coin_events (
    kind, host_address, title, bitmap_height, description, prize, prize_coins,
    entry_cost, max_entries, ends_at, status
  ) VALUES (
    _kind, _host_address, _title, _bitmap_height, _description, _prize, _prize_coins,
    _entry_cost, _max_entries, _ends_at, 'open'
  ) RETURNING id INTO event_id;

  IF _prize_coins > 0 THEN
    PERFORM public.coin_apply(_host_address, -_prize_coins, 'event_prize_locked', event_id::text);
  END IF;

  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_create_event(text, text, text, bigint, text, text, bigint, bigint, integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_create_event(text, text, text, bigint, text, text, bigint, bigint, integer, timestamptz) TO service_role;

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
     SET status = 'drawn',
         winner_address = winner,
         drawn_at = now(),
         prize_paid_at = CASE WHEN ev.prize_coins > 0 THEN now() ELSE prize_paid_at END
   WHERE id = _event_id;

  IF ev.prize_coins > 0 THEN
    PERFORM public.coin_apply(winner, ev.prize_coins, 'event_prize_won', _event_id::text);
  END IF;

  RETURN winner;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_draw_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_draw_event(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.coin_close_event(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.coin_events;
BEGIN
  SELECT * INTO ev FROM public.coin_events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'event not found'; END IF;
  IF ev.status <> 'open' THEN RAISE EXCEPTION 'this event is already settled'; END IF;

  UPDATE public.coin_events SET status = 'closed' WHERE id = _event_id;

  IF ev.prize_coins > 0 AND ev.prize_paid_at IS NULL THEN
    PERFORM public.coin_apply(ev.host_address, ev.prize_coins, 'event_prize_refund', _event_id::text);
    UPDATE public.coin_events SET prize_paid_at = now() WHERE id = _event_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.coin_close_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coin_close_event(uuid) TO service_role;