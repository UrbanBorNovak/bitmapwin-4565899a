ALTER TABLE public.launch_seats ADD COLUMN club_hair text CHECK (club_hair IN ('marauders','emporium'));
ALTER TABLE public.launch_seats ADD COLUMN club_proof text;
ALTER TABLE public.launch_seats ADD COLUMN club_checked_at timestamptz;
GRANT SELECT (club_hair, club_proof, club_checked_at) ON public.launch_seats TO anon, authenticated;