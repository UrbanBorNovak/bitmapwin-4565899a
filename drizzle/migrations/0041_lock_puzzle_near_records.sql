DROP POLICY IF EXISTS "Public can read near records" ON public.puzzle_near_records;
REVOKE ALL ON public.puzzle_near_records FROM anon, authenticated;
CREATE POLICY "No direct browser access" ON public.puzzle_near_records FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);