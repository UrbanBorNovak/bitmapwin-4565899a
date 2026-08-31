CREATE TABLE public.inscriptions (
  id text PRIMARY KEY,
  txid text NOT NULL,
  input_index integer NOT NULL DEFAULT 0,
  block_height bigint,
  content_type text,
  body_text text,
  body_bytes integer NOT NULL DEFAULT 0,
  is_bitmap_claim boolean NOT NULL DEFAULT false,
  bitmap_height bigint,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX inscriptions_block_height_idx ON public.inscriptions (block_height);
CREATE INDEX inscriptions_bitmap_height_idx ON public.inscriptions (bitmap_height);
CREATE INDEX inscriptions_txid_idx ON public.inscriptions (txid);

GRANT SELECT, INSERT, UPDATE ON public.inscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inscriptions TO anon;
GRANT ALL ON public.inscriptions TO service_role;

ALTER TABLE public.inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inscriptions_public_read" ON public.inscriptions FOR SELECT USING (true);
CREATE POLICY "inscriptions_public_insert" ON public.inscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "inscriptions_public_upsert_update" ON public.inscriptions FOR UPDATE USING (true) WITH CHECK (true);

CREATE TRIGGER update_inscriptions_updated_at BEFORE UPDATE ON public.inscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();