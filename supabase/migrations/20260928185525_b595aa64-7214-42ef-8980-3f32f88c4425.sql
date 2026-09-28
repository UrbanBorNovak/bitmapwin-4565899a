CREATE OR REPLACE FUNCTION public.shadow_claim_pass(_slug text, _commitment text)
RETURNS TABLE(ok boolean, reason text, pass_index integer, passes_issued integer, max_passes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_active boolean;
  v_issued integer;
  v_max integer;
  v_next integer;
BEGIN
  SELECT e.id, e.is_active, e.passes_issued, e.max_passes
    INTO v_id, v_active, v_issued, v_max
    FROM public.shadow_events e WHERE e.slug = _slug FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, 'NO SUCH EVENT'::text, 0, 0, 0; RETURN;
  END IF;
  IF NOT v_active THEN
    RETURN QUERY SELECT false, 'EVENT CLOSED'::text, 0, v_issued, v_max; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shadow_commitments c WHERE c.event_id = v_id AND c.commitment_hash = _commitment) THEN
    RETURN QUERY SELECT false, 'PASS ALREADY REGISTERED'::text, 0, v_issued, v_max; RETURN;
  END IF;
  IF v_issued >= v_max THEN
    RETURN QUERY SELECT false, 'ALL PASSES ISSUED'::text, 0, v_issued, v_max; RETURN;
  END IF;

  INSERT INTO public.shadow_commitments (event_id, commitment_hash) VALUES (v_id, _commitment);

  UPDATE public.shadow_events e SET passes_issued = e.passes_issued + 1
   WHERE e.id = v_id
   RETURNING e.passes_issued INTO v_next;

  RETURN QUERY SELECT true, 'OK'::text, v_next, v_next, v_max;
END;
$$;

REVOKE ALL ON FUNCTION public.shadow_claim_pass(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shadow_claim_pass(text, text) TO service_role;