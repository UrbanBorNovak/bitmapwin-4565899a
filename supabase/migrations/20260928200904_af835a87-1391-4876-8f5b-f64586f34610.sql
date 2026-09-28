CREATE TABLE public.shadow_spent_commitments (
  event_id uuid NOT NULL REFERENCES public.shadow_events(id) ON DELETE CASCADE,
  commitment_hash text NOT NULL,
  spent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, commitment_hash)
);
GRANT ALL ON public.shadow_spent_commitments TO service_role;
ALTER TABLE public.shadow_spent_commitments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.shadow_transfer_pass(_slug text, _salt text, _new_commitment text)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE v_id uuid; v_old text;
BEGIN
  IF _salt !~ '^[0-9a-f]{64}$' OR _new_commitment !~ '^[0-9a-f]{64}$' THEN
    RETURN QUERY SELECT false, 'MALFORMED TRANSFER'::text; RETURN;
  END IF;
  SELECT e.id INTO v_id FROM public.shadow_events e WHERE e.slug = _slug FOR UPDATE;
  IF v_id IS NULL THEN RETURN QUERY SELECT false, 'NO SUCH EVENT'::text; RETURN; END IF;
  v_old := encode(extensions.digest(convert_to('bitmapwin:shadow:commit|' || _slug || '|' || _salt, 'UTF8'), 'sha256'), 'hex');
  IF v_old = _new_commitment THEN RETURN QUERY SELECT false, 'CANNOT SEND TO THE SAME PASS'::text; RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shadow_commitments c WHERE c.event_id = v_id AND c.commitment_hash = v_old) THEN
    RETURN QUERY SELECT false, 'PASS NOT FOUND OR ALREADY SENT'::text; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shadow_commitments c WHERE c.event_id = v_id AND c.commitment_hash = _new_commitment)
     OR EXISTS (SELECT 1 FROM public.shadow_spent_commitments s WHERE s.event_id = v_id AND s.commitment_hash = _new_commitment) THEN
    RETURN QUERY SELECT false, 'RECEIVE CODE ALREADY USED'::text; RETURN;
  END IF;
  DELETE FROM public.shadow_commitments c WHERE c.event_id = v_id AND c.commitment_hash = v_old;
  INSERT INTO public.shadow_spent_commitments (event_id, commitment_hash) VALUES (v_id, v_old);
  INSERT INTO public.shadow_commitments (event_id, commitment_hash) VALUES (v_id, _new_commitment);
  RETURN QUERY SELECT true, 'OK'::text;
END; $$;
REVOKE ALL ON FUNCTION public.shadow_transfer_pass(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shadow_transfer_pass(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.shadow_block_spent_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.shadow_spent_commitments s WHERE s.event_id = NEW.event_id AND s.commitment_hash = NEW.commitment_hash) THEN
    RAISE EXCEPTION 'SPENT PASS CANNOT BE REUSED';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER shadow_commitments_block_spent BEFORE INSERT ON public.shadow_commitments
FOR EACH ROW EXECUTE FUNCTION public.shadow_block_spent_claim();