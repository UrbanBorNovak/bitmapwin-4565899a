ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS reserved_by text, ADD COLUMN IF NOT EXISTS reserved_until timestamptz;

CREATE OR REPLACE FUNCTION public.reserve_offer(_offer_id uuid, _buyer text, _seconds integer DEFAULT 90)
RETURNS TABLE(ok boolean, reserved_until timestamptz, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.offers%ROWTYPE; active int;
BEGIN
  SELECT count(*) INTO active FROM public.offers o
   WHERE o.reserved_by = _buyer AND o.reserved_until > now() AND o.id <> _offer_id AND o.status = 'open';
  IF active >= 2 THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'TOO MANY ACTIVE CHECKOUTS'::text; RETURN;
  END IF;
  UPDATE public.offers o SET reserved_by = _buyer,
    reserved_until = now() + make_interval(secs => LEAST(GREATEST(_seconds,30),120)), updated_at = now()
   WHERE o.id = _offer_id AND o.status = 'open'
     AND (o.reserved_until IS NULL OR o.reserved_until < now() OR o.reserved_by = _buyer)
  RETURNING * INTO r;
  IF FOUND THEN RETURN QUERY SELECT true, r.reserved_until, NULL::text; RETURN; END IF;
  SELECT * INTO r FROM public.offers o WHERE o.id = _offer_id;
  IF NOT FOUND OR r.status <> 'open' THEN
    RETURN QUERY SELECT false, NULL::timestamptz, 'OFFER NO LONGER OPEN'::text; RETURN;
  END IF;
  RETURN QUERY SELECT false, r.reserved_until,
    ('LISTING RESERVED BY ANOTHER BUYER (' || GREATEST(1, ceil(extract(epoch FROM r.reserved_until - now())))::int || 's REMAINING)')::text;
END $$;

CREATE OR REPLACE FUNCTION public.release_offer_reservation(_offer_id uuid, _buyer text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.offers SET reserved_by = NULL, reserved_until = NULL, updated_at = now()
    WHERE id = _offer_id AND reserved_by = _buyer RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;

REVOKE ALL ON FUNCTION public.reserve_offer(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_offer_reservation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_offer(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_offer_reservation(uuid, text) TO service_role;