CREATE TABLE public.raid_squad_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boss_slug text NOT NULL,
  guardian_height bigint NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'striker',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guardian_height)
);
CREATE INDEX raid_squad_boss ON public.raid_squad_members (boss_slug);
GRANT ALL ON public.raid_squad_members TO service_role;
ALTER TABLE public.raid_squad_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No direct browser access" ON public.raid_squad_members FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);