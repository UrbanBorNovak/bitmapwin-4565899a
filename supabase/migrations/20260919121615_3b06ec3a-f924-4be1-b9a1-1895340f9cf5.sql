CREATE TABLE public.player_builds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  builder_address text,
  chunk_key text NOT NULL,
  bitmap_height bigint NOT NULL,
  kind text NOT NULL,
  x numeric NOT NULL,
  z numeric NOT NULL,
  yaw numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX player_builds_user_idx ON public.player_builds (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.player_builds TO authenticated;
GRANT ALL ON public.player_builds TO service_role;

ALTER TABLE public.player_builds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players see their own saved builds"
  ON public.player_builds FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players save their own builds"
  ON public.player_builds FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players remove their own saved builds"
  ON public.player_builds FOR DELETE TO authenticated
  USING (auth.uid() = user_id);