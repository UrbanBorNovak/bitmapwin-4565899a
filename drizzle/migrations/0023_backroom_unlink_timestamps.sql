UPDATE public.biternam_backroom_claims SET claimed_at = date_trunc('day', claimed_at);
UPDATE public.shadow_commitments s SET created_at = date_trunc('day', s.created_at)
  FROM public.shadow_events e WHERE e.id = s.event_id AND e.slug LIKE 'biternam-backroom-%';
CREATE OR REPLACE FUNCTION public.biternam_claim_backroom(_user uuid, _slug text, _commitment text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_day timestamptz := date_trunc('day', now());
BEGIN
  IF _commitment !~ '^[0-9a-f]{64}$' OR _slug !~ '^biternam-backroom-' THEN RETURN 'MALFORMED'; END IF;
  SELECT id INTO v_id FROM public.shadow_events WHERE slug = _slug FOR UPDATE;
  IF v_id IS NULL THEN RETURN 'NO SUCH BACKROOM'; END IF;
  IF EXISTS (SELECT 1 FROM public.biternam_backroom_claims WHERE user_id = _user AND slug = _slug) THEN RETURN 'ALREADY CLAIMED'; END IF;
  IF EXISTS (SELECT 1 FROM public.shadow_commitments WHERE event_id = v_id AND commitment_hash = _commitment) THEN RETURN 'PASS ALREADY REGISTERED'; END IF;
  INSERT INTO public.biternam_backroom_claims (user_id, slug, claimed_at) VALUES (_user, _slug, v_day);
  INSERT INTO public.shadow_commitments (event_id, commitment_hash, created_at) VALUES (v_id, _commitment, v_day);
  UPDATE public.shadow_events SET passes_issued = passes_issued + 1 WHERE id = v_id;
  RETURN 'OK';
END;
$function$;
REVOKE ALL ON FUNCTION public.biternam_claim_backroom(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biternam_claim_backroom(uuid, text, text) TO service_role;