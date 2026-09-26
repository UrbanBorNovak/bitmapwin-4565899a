GRANT SELECT ON TABLE public.offers TO anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.offers TO authenticated;
GRANT ALL ON TABLE public.offers TO service_role;