CREATE TABLE public.play_profiles (
  wallet_address text PRIMARY KEY,
  user_id uuid NOT NULL,
  profile jsonb NOT NULL,
  matches integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.play_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.play_profiles TO authenticated;
GRANT ALL ON public.play_profiles TO service_role;
ALTER TABLE public.play_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "play profiles are public" ON public.play_profiles FOR SELECT USING (true);
CREATE POLICY "wallet owner inserts play profile" ON public.play_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.owns_wallet(auth.uid(), wallet_address));
CREATE POLICY "wallet owner updates play profile" ON public.play_profiles FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), wallet_address))
  WITH CHECK (user_id = auth.uid() AND public.owns_wallet(auth.uid(), wallet_address));
CREATE TRIGGER play_profiles_updated_at BEFORE UPDATE ON public.play_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();