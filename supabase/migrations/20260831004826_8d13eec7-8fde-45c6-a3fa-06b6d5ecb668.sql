CREATE TABLE public.bitmap_index (
  block_height bigint PRIMARY KEY,
  sat bigint NOT NULL,
  sat_index integer NOT NULL DEFAULT 0,
  inscription_id text,
  content text,
  is_valid boolean NOT NULL DEFAULT false,
  genesis_height bigint,
  owner_address text,
  resolved_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX bitmap_index_valid_idx ON public.bitmap_index (is_valid);
CREATE INDEX bitmap_index_inscription_idx ON public.bitmap_index (inscription_id);

GRANT SELECT ON public.bitmap_index TO anon;
GRANT SELECT, INSERT, UPDATE ON public.bitmap_index TO authenticated;
GRANT ALL ON public.bitmap_index TO service_role;

ALTER TABLE public.bitmap_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY bitmap_index_public_read ON public.bitmap_index FOR SELECT USING (true);
CREATE POLICY bitmap_index_public_insert ON public.bitmap_index FOR INSERT WITH CHECK (true);
CREATE POLICY bitmap_index_public_update ON public.bitmap_index FOR UPDATE USING (true) WITH CHECK (true);