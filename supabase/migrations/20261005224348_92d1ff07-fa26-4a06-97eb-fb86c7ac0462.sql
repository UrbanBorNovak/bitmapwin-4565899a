CREATE TABLE public.guardian_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_height bigint NOT NULL REFERENCES public.bitmon_guardians(block_height) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  directive text NOT NULL CHECK (directive IN ('patrol','march','farm')),
  target_height bigint,
  waypoints jsonb NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  recalled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guardian_dispatches_live ON public.guardian_dispatches (ends_at DESC);
CREATE INDEX guardian_dispatches_guardian ON public.guardian_dispatches (guardian_height, ends_at DESC);
GRANT SELECT ON public.guardian_dispatches TO anon, authenticated;
GRANT ALL ON public.guardian_dispatches TO service_role;
ALTER TABLE public.guardian_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispatch routes are public" ON public.guardian_dispatches FOR SELECT TO anon, authenticated USING (true);