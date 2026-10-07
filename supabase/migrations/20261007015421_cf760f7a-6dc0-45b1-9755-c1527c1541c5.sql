DROP POLICY IF EXISTS "Anyone can see boss strikes" ON public.boss_strikes;
DROP POLICY IF EXISTS "Anyone can see guardian loot" ON public.guardian_loot;
DROP POLICY IF EXISTS "Anyone can see boss state" ON public.epic_bosses;
REVOKE ALL ON public.boss_strikes, public.guardian_loot, public.epic_bosses FROM anon, authenticated;
CREATE POLICY "No direct browser access" ON public.boss_strikes FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct browser access" ON public.guardian_loot FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No direct browser access" ON public.epic_bosses FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);