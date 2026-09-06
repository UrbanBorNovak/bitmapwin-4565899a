CREATE TABLE public.world_structures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_key text NOT NULL,
  bitmap_height bigint NOT NULL,
  tile_col integer NOT NULL,
  tile_row integer NOT NULL,
  kind text NOT NULL,
  x numeric NOT NULL,
  z numeric NOT NULL,
  yaw numeric NOT NULL DEFAULT 0,
  builder_user_id uuid NOT NULL,
  builder_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX world_structures_chunk_idx ON public.world_structures (chunk_key);
CREATE INDEX world_structures_height_idx ON public.world_structures (bitmap_height);
CREATE INDEX world_structures_builder_idx ON public.world_structures (builder_user_id);

GRANT SELECT ON public.world_structures TO anon;
GRANT SELECT, INSERT, DELETE ON public.world_structures TO authenticated;
GRANT ALL ON public.world_structures TO service_role;

ALTER TABLE public.world_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can see world structures"
  ON public.world_structures FOR SELECT
  USING (true);

CREATE POLICY "Signed-in players can raise structures"
  ON public.world_structures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = builder_user_id);

CREATE POLICY "Builders can remove their own structures"
  ON public.world_structures FOR DELETE
  TO authenticated
  USING (auth.uid() = builder_user_id);

CREATE OR REPLACE FUNCTION public.world_structures_in_chunks(_keys text[])
RETURNS TABLE (
  id uuid,
  chunk_key text,
  bitmap_height bigint,
  tile_col integer,
  tile_row integer,
  kind text,
  x numeric,
  z numeric,
  yaw numeric,
  builder_address text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT s.id, s.chunk_key, s.bitmap_height, s.tile_col, s.tile_row, s.kind,
         s.x, s.z, s.yaw, s.builder_address, s.created_at
  FROM public.world_structures s
  WHERE s.chunk_key = ANY(_keys)
  ORDER BY s.created_at
  LIMIT 4000
$$;

GRANT EXECUTE ON FUNCTION public.world_structures_in_chunks(text[]) TO anon, authenticated, service_role;