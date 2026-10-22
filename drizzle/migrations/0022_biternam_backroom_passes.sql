CREATE TABLE public.biternam_backroom_claims (
  user_id uuid NOT NULL,
  slug text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slug)
);
REVOKE ALL ON public.biternam_backroom_claims FROM anon, authenticated;
GRANT ALL ON public.biternam_backroom_claims TO service_role;
ALTER TABLE public.biternam_backroom_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backroom claims deny browser" ON public.biternam_backroom_claims FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
COMMENT ON TABLE public.biternam_backroom_claims IS 'One earned Biternam backroom pass per account; never stores the commitment, so the pass is not linked to the account.';

CREATE OR REPLACE FUNCTION public.biternam_claim_backroom(_user uuid, _slug text, _commitment text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _commitment !~ '^[0-9a-f]{64}$' OR _slug !~ '^biternam-backroom-' THEN RETURN 'MALFORMED'; END IF;
  SELECT id INTO v_id FROM public.shadow_events WHERE slug = _slug FOR UPDATE;
  IF v_id IS NULL THEN RETURN 'NO SUCH BACKROOM'; END IF;
  IF EXISTS (SELECT 1 FROM public.biternam_backroom_claims WHERE user_id = _user AND slug = _slug) THEN RETURN 'ALREADY CLAIMED'; END IF;
  IF EXISTS (SELECT 1 FROM public.shadow_commitments WHERE event_id = v_id AND commitment_hash = _commitment) THEN RETURN 'PASS ALREADY REGISTERED'; END IF;
  INSERT INTO public.biternam_backroom_claims (user_id, slug) VALUES (_user, _slug);
  INSERT INTO public.shadow_commitments (event_id, commitment_hash) VALUES (v_id, _commitment);
  UPDATE public.shadow_events SET passes_issued = passes_issued + 1 WHERE id = v_id;
  RETURN 'OK';
END;
$$;
REVOKE ALL ON FUNCTION public.biternam_claim_backroom(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biternam_claim_backroom(uuid, text, text) TO service_role;