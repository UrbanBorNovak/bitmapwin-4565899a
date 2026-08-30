CREATE TABLE public.bitmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_height bigint NOT NULL UNIQUE,
  inscription_id text,
  owner_address text,
  status text NOT NULL DEFAULT 'unclaimed',
  price_btc numeric(16,8),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_id uuid NOT NULL REFERENCES public.bitmaps(id) ON DELETE CASCADE,
  seller_address text NOT NULL,
  price_btc numeric(16,8) NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  bitmap_id uuid REFERENCES public.bitmaps(id) ON DELETE SET NULL,
  wallet_address text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bitmaps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bitmaps TO authenticated;
GRANT ALL ON public.bitmaps TO service_role;
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
GRANT SELECT ON public.activity TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity TO authenticated;
GRANT ALL ON public.activity TO service_role;

ALTER TABLE public.bitmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bitmaps_public_read" ON public.bitmaps FOR SELECT USING (true);
CREATE POLICY "bitmaps_auth_write" ON public.bitmaps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "listings_public_read" ON public.listings FOR SELECT USING (true);
CREATE POLICY "listings_auth_write" ON public.listings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "activity_public_read" ON public.activity FOR SELECT USING (true);
CREATE POLICY "activity_auth_write" ON public.activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_bitmaps_updated_at BEFORE UPDATE ON public.bitmaps
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bitmaps (block_height, inscription_id, owner_address, status, price_btc, created_at)
SELECT
  b.h,
  'demo-' || b.h || 'i0',
  CASE WHEN (b.h % 7) = 3 THEN NULL
       ELSE 'bc1q' || substr(md5(b.h::text), 1, 6) || '...' || substr(md5(b.h::text), 27, 4) END,
  CASE WHEN (b.h % 7) = 3 THEN 'unclaimed'
       WHEN (b.h % 3) = 0 THEN 'for_sale'
       ELSE 'owned' END,
  CASE WHEN (b.h % 7) <> 3 AND (b.h % 3) = 0
       THEN round(((b.h % 97) + 8)::numeric / 1000, 8) END,
  now() - ((840040 - b.h) * interval '37 minutes')
FROM generate_series(839961, 840040) AS b(h);

INSERT INTO public.listings (bitmap_id, seller_address, price_btc, status, created_at)
SELECT id, owner_address, price_btc, 'active', created_at
FROM public.bitmaps WHERE status = 'for_sale';

INSERT INTO public.activity (type, bitmap_id, wallet_address, metadata, created_at)
SELECT
  CASE WHEN (block_height % 3) = 0 THEN 'listed'
       WHEN (block_height % 3) = 1 THEN 'sold'
       ELSE 'discovered' END,
  id,
  owner_address,
  jsonb_build_object('price_btc', price_btc, 'block', block_height),
  now() - ((840040 - block_height) * interval '11 minutes')
FROM public.bitmaps
WHERE block_height > 840000;