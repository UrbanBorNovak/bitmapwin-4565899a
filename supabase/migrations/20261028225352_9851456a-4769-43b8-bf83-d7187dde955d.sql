CREATE TABLE public.advent_signups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  handle text NOT NULL DEFAULT '' CHECK (char_length(handle) <= 24),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.advent_signups TO authenticated;
GRANT USAGE ON SEQUENCE public.advent_signups_id_seq TO authenticated;
GRANT ALL ON public.advent_signups TO service_role;
ALTER TABLE public.advent_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own advent signup read" ON public.advent_signups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own advent signup insert" ON public.advent_signups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.advent_signup_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT count(*)::int FROM public.advent_signups $$;
GRANT EXECUTE ON FUNCTION public.advent_signup_count() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.advent_card_number()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT count(*)::int FROM public.advent_signups s
      WHERE s.id <= (SELECT id FROM public.advent_signups WHERE user_id = auth.uid()) $$;
GRANT EXECUTE ON FUNCTION public.advent_card_number() TO authenticated;