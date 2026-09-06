CREATE TABLE public.land_terraform (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chunk_key text NOT NULL,
  bitmap_height bigint NOT NULL UNIQUE,
  tile_col integer NOT NULL,
  tile_row integer NOT NULL,
  seeded_at timestamp with time zone NOT NULL DEFAULT now(),
  seeded_by_user_id uuid NOT NULL,
  seeded_by_address text
);

CREATE INDEX land_terraform_chunk_idx ON public.land_terraform (chunk_key);
CREATE INDEX land_terraform_owner_idx ON public.land_terraform (seeded_by_user_id);

GRANT SELECT ON public.land_terraform TO anon;
GRANT SELECT, INSERT, DELETE ON public.land_terraform TO authenticated;
GRANT ALL ON public.land_terraform TO service_role;

ALTER TABLE public.land_terraform ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can see terraformed land"
  ON public.land_terraform FOR SELECT
  USING (true);

CREATE POLICY "Signed-in players can seed terraforming"
  ON public.land_terraform FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seeded_by_user_id);

CREATE POLICY "Players can undo their own terraforming"
  ON public.land_terraform FOR DELETE
  TO authenticated
  USING (auth.uid() = seeded_by_user_id);

CREATE OR REPLACE FUNCTION public.land_terraform_in_chunks(_keys text[])
RETURNS TABLE (
  id uuid,
  chunk_key text,
  bitmap_height bigint,
  tile_col integer,
  tile_row integer,
  seeded_at timestamp with time zone,
  seeded_by_address text
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT t.id, t.chunk_key, t.bitmap_height, t.tile_col, t.tile_row, t.seeded_at, t.seeded_by_address
  FROM public.land_terraform t
  WHERE t.chunk_key = ANY(_keys)
  ORDER BY t.seeded_at
  LIMIT 4000
$$;

GRANT EXECUTE ON FUNCTION public.land_terraform_in_chunks(text[]) TO anon, authenticated, service_role;