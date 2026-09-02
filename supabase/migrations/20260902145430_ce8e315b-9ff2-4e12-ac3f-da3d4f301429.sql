CREATE TABLE public.bitmap_watches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bitmap_height bigint NOT NULL,
  watch_bids boolean NOT NULL DEFAULT true,
  watch_visits boolean NOT NULL DEFAULT true,
  watch_builds boolean NOT NULL DEFAULT true,
  watch_leases boolean NOT NULL DEFAULT true,
  watch_trades boolean NOT NULL DEFAULT true,
  watch_coins boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, bitmap_height)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bitmap_watches TO authenticated;
GRANT ALL ON public.bitmap_watches TO service_role;

ALTER TABLE public.bitmap_watches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own watches"
  ON public.bitmap_watches FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX bitmap_watches_user_idx ON public.bitmap_watches (user_id, bitmap_height);

CREATE TRIGGER bitmap_watches_updated_at
  BEFORE UPDATE ON public.bitmap_watches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();