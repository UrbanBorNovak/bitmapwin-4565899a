CREATE TABLE public.build_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bitmap_height integer NOT NULL,
  parcel_index integer,
  proposer_address text NOT NULL,
  role text NOT NULL,
  blocks jsonb NOT NULL,
  block_count integer NOT NULL,
  model_inscription_id text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX build_proposals_user_idx ON public.build_proposals (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.build_proposals TO authenticated;
GRANT ALL ON public.build_proposals TO service_role;
ALTER TABLE public.build_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own build proposals read" ON public.build_proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own build proposals insert" ON public.build_proposals FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.wallet_links w WHERE w.user_id = auth.uid() AND w.address = proposer_address));
CREATE POLICY "own build proposals decide" ON public.build_proposals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.build_proposal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role NOT IN ('bitmap','parcel') THEN RAISE EXCEPTION 'bad role'; END IF;
    IF NEW.block_count > 12000 OR jsonb_array_length(NEW.blocks) <> NEW.block_count THEN RAISE EXCEPTION 'bad blocks'; END IF;
    NEW.status := 'pending'; NEW.decided_at := NULL; NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'proposal already decided'; END IF;
  IF NEW.status NOT IN ('applied','rejected') THEN RAISE EXCEPTION 'bad status'; END IF;
  NEW.id := OLD.id; NEW.user_id := OLD.user_id; NEW.bitmap_height := OLD.bitmap_height; NEW.parcel_index := OLD.parcel_index;
  NEW.proposer_address := OLD.proposer_address; NEW.role := OLD.role; NEW.blocks := OLD.blocks; NEW.block_count := OLD.block_count;
  NEW.model_inscription_id := OLD.model_inscription_id; NEW.note := OLD.note; NEW.created_at := OLD.created_at;
  NEW.decided_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.build_proposal_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER build_proposal_guard BEFORE INSERT OR UPDATE ON public.build_proposals
  FOR EACH ROW EXECUTE FUNCTION public.build_proposal_guard();