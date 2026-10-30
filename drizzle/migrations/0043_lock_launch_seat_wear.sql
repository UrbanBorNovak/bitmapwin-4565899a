DROP POLICY IF EXISTS "Wardrobe is public to view" ON public.launch_seat_wear;
REVOKE ALL ON public.launch_seat_wear FROM anon, authenticated;
GRANT ALL ON public.launch_seat_wear TO service_role;
CREATE POLICY "No direct browser access" ON public.launch_seat_wear FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);