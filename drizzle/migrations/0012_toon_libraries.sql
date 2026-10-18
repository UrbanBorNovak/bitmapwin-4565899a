CREATE TABLE public.toon_libraries (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{"series":[],"casts":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT toon_libraries_size CHECK (pg_column_size(data) < 2000000)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toon_libraries TO authenticated;
GRANT ALL ON public.toon_libraries TO service_role;
ALTER TABLE public.toon_libraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own toon library read" ON public.toon_libraries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own toon library insert" ON public.toon_libraries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own toon library update" ON public.toon_libraries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own toon library delete" ON public.toon_libraries FOR DELETE TO authenticated USING (auth.uid() = user_id);