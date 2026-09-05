CREATE TABLE public.extender_state (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id uuid NOT NULL REFERENCES public.extender_deployments(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('shared','player')),
  actor uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope = 'shared' AND actor IS NULL) OR (scope = 'player' AND actor IS NOT NULL))
);

CREATE UNIQUE INDEX extender_state_shared_key ON public.extender_state (deployment_id) WHERE scope = 'shared';
CREATE UNIQUE INDEX extender_state_player_key ON public.extender_state (deployment_id, actor) WHERE scope = 'player';

GRANT SELECT ON public.extender_state TO anon;
GRANT SELECT, INSERT, UPDATE ON public.extender_state TO authenticated;
GRANT ALL ON public.extender_state TO service_role;

ALTER TABLE public.extender_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared extender state is public" ON public.extender_state
  FOR SELECT USING (scope = 'shared');

CREATE POLICY "players read their own extender state" ON public.extender_state
  FOR SELECT TO authenticated USING (scope = 'player' AND actor = auth.uid());

CREATE POLICY "signed in visitors write shared extender state" ON public.extender_state
  FOR INSERT TO authenticated WITH CHECK (scope = 'shared' AND actor IS NULL);

CREATE POLICY "signed in visitors update shared extender state" ON public.extender_state
  FOR UPDATE TO authenticated USING (scope = 'shared') WITH CHECK (scope = 'shared' AND actor IS NULL);

CREATE POLICY "players write their own extender state" ON public.extender_state
  FOR INSERT TO authenticated WITH CHECK (scope = 'player' AND actor = auth.uid());

CREATE POLICY "players update their own extender state" ON public.extender_state
  FOR UPDATE TO authenticated USING (scope = 'player' AND actor = auth.uid())
  WITH CHECK (scope = 'player' AND actor = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_extender_state() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER extender_state_touch BEFORE UPDATE ON public.extender_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_extender_state();