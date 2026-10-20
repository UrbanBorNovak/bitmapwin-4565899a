CREATE TABLE public.agent_proposals (
  id text NOT NULL,
  user_id uuid NOT NULL,
  citizen_id text NOT NULL,
  kind text NOT NULL,
  summary text NOT NULL,
  href text NOT NULL,
  offer_id uuid,
  item text,
  price_sats bigint,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  stale_why text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE ON public.agent_proposals TO authenticated;
GRANT ALL ON public.agent_proposals TO service_role;
ALTER TABLE public.agent_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own proposals read" ON public.agent_proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own proposals insert" ON public.agent_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own proposals decide" ON public.agent_proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agent_proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  proposal_id text NOT NULL,
  event text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agent_proposal_events TO authenticated;
GRANT ALL ON public.agent_proposal_events TO service_role;
ALTER TABLE public.agent_proposal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.agent_proposal_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.agent_proposal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind NOT IN ('trade','spend') THEN RAISE EXCEPTION 'bad kind'; END IF;
    NEW.status := 'pending'; NEW.decided_at := NULL; NEW.stale_why := NULL; NEW.created_at := now();
    INSERT INTO agent_proposal_events(user_id, proposal_id, event, detail)
      VALUES (NEW.user_id, NEW.id, 'proposed', NEW.summary);
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'proposal already decided'; END IF;
  IF NEW.status NOT IN ('approved','rejected','stale') THEN RAISE EXCEPTION 'bad status'; END IF;
  -- only the decision fields may change
  NEW.id := OLD.id; NEW.user_id := OLD.user_id; NEW.citizen_id := OLD.citizen_id; NEW.kind := OLD.kind;
  NEW.summary := OLD.summary; NEW.href := OLD.href; NEW.offer_id := OLD.offer_id; NEW.item := OLD.item;
  NEW.price_sats := OLD.price_sats; NEW.reason := OLD.reason; NEW.created_at := OLD.created_at;
  NEW.decided_at := now();
  IF NEW.status <> 'stale' THEN NEW.stale_why := NULL; END IF;
  INSERT INTO agent_proposal_events(user_id, proposal_id, event, detail)
    VALUES (NEW.user_id, NEW.id, NEW.status, NEW.stale_why);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.agent_proposal_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER agent_proposal_guard BEFORE INSERT OR UPDATE ON public.agent_proposals
  FOR EACH ROW EXECUTE FUNCTION public.agent_proposal_guard();