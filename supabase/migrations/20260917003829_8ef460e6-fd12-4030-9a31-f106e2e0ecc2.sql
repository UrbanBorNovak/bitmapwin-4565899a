CREATE TABLE public.clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tag text NOT NULL,
  leader_user_id uuid NOT NULL,
  crest_inscription_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clans_name_length CHECK (char_length(btrim(name)) BETWEEN 2 AND 32),
  CONSTRAINT clans_tag_format CHECK (tag ~ '^[A-Z0-9]{2,6}$'),
  CONSTRAINT clans_crest_image_inscription CHECK (crest_inscription_id ~ '^[0-9a-f]{64}i[0-9]+$'),
  CONSTRAINT clans_name_unique UNIQUE (name),
  CONSTRAINT clans_tag_unique UNIQUE (tag),
  CONSTRAINT clans_leader_unique UNIQUE (leader_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clans TO authenticated;
GRANT SELECT ON public.clans TO anon;
GRANT ALL ON public.clans TO service_role;
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clans are public" ON public.clans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Players create their own clan" ON public.clans FOR INSERT TO authenticated WITH CHECK (leader_user_id = auth.uid());
CREATE POLICY "Leaders update their clan" ON public.clans FOR UPDATE TO authenticated USING (leader_user_id = auth.uid()) WITH CHECK (leader_user_id = auth.uid());
CREATE POLICY "Leaders delete their clan" ON public.clans FOR DELETE TO authenticated USING (leader_user_id = auth.uid());
CREATE TRIGGER update_clans_updated_at BEFORE UPDATE ON public.clans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.clan_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan_id uuid NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clan_members_role CHECK (role IN ('leader', 'member')),
  CONSTRAINT clan_members_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT clan_members_unique_clan_user UNIQUE (clan_id, user_id)
);
CREATE UNIQUE INDEX clan_members_one_accepted_clan_per_user ON public.clan_members(user_id) WHERE status = 'accepted';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clan_members TO authenticated;
GRANT SELECT ON public.clan_members TO anon;
GRANT ALL ON public.clan_members TO service_role;
ALTER TABLE public.clan_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accepted clan memberships are public" ON public.clan_members FOR SELECT TO anon, authenticated USING (status = 'accepted');
CREATE POLICY "Players see their clan requests" ON public.clan_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Leaders see clan requests" ON public.clan_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_members.clan_id AND c.leader_user_id = auth.uid()));
CREATE POLICY "Players request clan membership" ON public.clan_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'member' AND status = 'pending');
CREATE POLICY "Leaders add their own membership" ON public.clan_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'leader' AND status = 'accepted' AND EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_members.clan_id AND c.leader_user_id = auth.uid()));
CREATE POLICY "Leaders decide clan requests" ON public.clan_members FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_members.clan_id AND c.leader_user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_members.clan_id AND c.leader_user_id = auth.uid()));
CREATE POLICY "Players withdraw requests" ON public.clan_members FOR DELETE TO authenticated USING (user_id = auth.uid() AND role = 'member');
CREATE POLICY "Leaders remove clan members" ON public.clan_members FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.clans c WHERE c.id = clan_members.clan_id AND c.leader_user_id = auth.uid()));
CREATE TRIGGER update_clan_members_updated_at BEFORE UPDATE ON public.clan_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_clan(_name text, _tag text, _crest_inscription_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _clan_id uuid;
BEGIN
  INSERT INTO public.clans (name, tag, leader_user_id, crest_inscription_id)
  VALUES (btrim(_name), upper(btrim(_tag)), auth.uid(), lower(btrim(_crest_inscription_id)))
  RETURNING id INTO _clan_id;
  INSERT INTO public.clan_members (clan_id, user_id, role, status)
  VALUES (_clan_id, auth.uid(), 'leader', 'accepted');
  RETURN _clan_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_clan(text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.clan_for_users(_user_ids uuid[])
RETURNS TABLE(user_id uuid, clan_id uuid, clan_name text, clan_tag text, crest_inscription_id text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT cm.user_id, c.id, c.name, c.tag, c.crest_inscription_id
  FROM public.clan_members cm
  JOIN public.clans c ON c.id = cm.clan_id
  WHERE cm.status = 'accepted' AND cm.user_id = ANY(_user_ids)
$$;
GRANT EXECUTE ON FUNCTION public.clan_for_users(uuid[]) TO anon, authenticated;