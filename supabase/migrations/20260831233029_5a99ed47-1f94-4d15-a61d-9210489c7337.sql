CREATE TABLE public.builder_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  builder_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, builder_address)
);

GRANT SELECT, INSERT, DELETE ON public.builder_follows TO authenticated;
GRANT SELECT ON public.builder_follows TO anon;
GRANT ALL ON public.builder_follows TO service_role;

ALTER TABLE public.builder_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "builder_follows_public_read" ON public.builder_follows FOR SELECT USING (true);
CREATE POLICY "builder_follows_owner_insert" ON public.builder_follows FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "builder_follows_owner_delete" ON public.builder_follows FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX builder_follows_builder_idx ON public.builder_follows (builder_address);