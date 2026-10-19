CREATE TABLE public.creator_channels (
  user_id uuid PRIMARY KEY,
  youtube text NOT NULL DEFAULT '' CHECK (char_length(youtube) <= 41),
  tiktok text NOT NULL DEFAULT '' CHECK (char_length(tiktok) <= 41),
  x text NOT NULL DEFAULT '' CHECK (char_length(x) <= 41),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_channels TO authenticated;
GRANT ALL ON public.creator_channels TO service_role;
ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own channels read" ON public.creator_channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own channels insert" ON public.creator_channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own channels update" ON public.creator_channels FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own channels delete" ON public.creator_channels FOR DELETE TO authenticated USING (auth.uid() = user_id);