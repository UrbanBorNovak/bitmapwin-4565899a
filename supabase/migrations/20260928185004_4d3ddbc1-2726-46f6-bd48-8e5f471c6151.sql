CREATE TABLE public.shadow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  territory_block bigint NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  max_passes integer NOT NULL CHECK (max_passes > 0),
  passes_issued integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shadow_events TO anon, authenticated;
GRANT ALL ON public.shadow_events TO service_role;
ALTER TABLE public.shadow_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shadow_events public read" ON public.shadow_events FOR SELECT USING (true);

CREATE TRIGGER shadow_events_touch BEFORE UPDATE ON public.shadow_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shadow_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.shadow_events(id) ON DELETE CASCADE,
  commitment_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, commitment_hash)
);

GRANT ALL ON public.shadow_commitments TO service_role;
ALTER TABLE public.shadow_commitments ENABLE ROW LEVEL SECURITY;
-- no policies: shielded set is readable only through trusted server routines

CREATE TABLE public.shadow_whispers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.shadow_events(id) ON DELETE CASCADE,
  nullifier_hash text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shadow_whispers_event_idx ON public.shadow_whispers (event_id, created_at DESC);
GRANT SELECT ON public.shadow_whispers TO anon, authenticated;
GRANT ALL ON public.shadow_whispers TO service_role;
ALTER TABLE public.shadow_whispers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shadow_whispers public read" ON public.shadow_whispers FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.shadow_claim_pass(_slug text, _commitment text)
RETURNS TABLE(ok boolean, reason text, pass_index integer, passes_issued integer, max_passes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev public.shadow_events;
BEGIN
  SELECT * INTO ev FROM public.shadow_events WHERE slug = _slug FOR UPDATE;
  IF ev.id IS NULL THEN
    RETURN QUERY SELECT false, 'NO SUCH EVENT', 0, 0, 0; RETURN;
  END IF;
  IF NOT ev.is_active THEN
    RETURN QUERY SELECT false, 'EVENT CLOSED', 0, ev.passes_issued, ev.max_passes; RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.shadow_commitments c WHERE c.event_id = ev.id AND c.commitment_hash = _commitment) THEN
    RETURN QUERY SELECT false, 'PASS ALREADY REGISTERED', 0, ev.passes_issued, ev.max_passes; RETURN;
  END IF;
  IF ev.passes_issued >= ev.max_passes THEN
    RETURN QUERY SELECT false, 'ALL PASSES ISSUED', 0, ev.passes_issued, ev.max_passes; RETURN;
  END IF;

  INSERT INTO public.shadow_commitments (event_id, commitment_hash) VALUES (ev.id, _commitment);
  UPDATE public.shadow_events SET passes_issued = passes_issued + 1 WHERE id = ev.id
    RETURNING passes_issued INTO pass_index;

  RETURN QUERY SELECT true, 'OK', pass_index, pass_index, ev.max_passes;
END;
$$;

CREATE OR REPLACE FUNCTION public.shadow_verify_pass(_slug text, _commitment text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shadow_commitments c
    JOIN public.shadow_events e ON e.id = c.event_id
    WHERE e.slug = _slug AND c.commitment_hash = _commitment
  );
$$;

CREATE OR REPLACE FUNCTION public.shadow_post_whisper(_slug text, _commitment text, _nullifier text, _content text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_id uuid;
BEGIN
  SELECT e.id INTO ev_id FROM public.shadow_events e
    JOIN public.shadow_commitments c ON c.event_id = e.id
   WHERE e.slug = _slug AND c.commitment_hash = _commitment;
  IF ev_id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.shadow_whispers (event_id, nullifier_hash, content)
  VALUES (ev_id, _nullifier, _content);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.shadow_claim_pass(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shadow_verify_pass(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shadow_post_whisper(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shadow_claim_pass(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shadow_verify_pass(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shadow_post_whisper(text, text, text, text) TO service_role;

INSERT INTO public.shadow_events (slug, territory_block, title, subtitle, description, max_passes)
VALUES (
  'cypherpunk-assembly',
  819245,
  'THE CYPHERPUNK ASSEMBLY',
  'GENESIS SHADOW GATE · 21 PASSES',
  'A shielded gathering beneath the orange tavern on 819,245.BITMAP. Your pass lives only on your device. Entry proves you belong without naming you, your wallet, or your account.',
  21
);