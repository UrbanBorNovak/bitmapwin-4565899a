CREATE TABLE public.guardian_auras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  height bigint NOT NULL,
  aura text NOT NULL,
  tier text NOT NULL,
  wager_bit integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_auras_user_idx ON public.guardian_auras(user_id, created_at DESC);
REVOKE ALL ON public.guardian_auras FROM anon, authenticated;
GRANT ALL ON public.guardian_auras TO service_role;
ALTER TABLE public.guardian_auras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.guardian_auras FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);