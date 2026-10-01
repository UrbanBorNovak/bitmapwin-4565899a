CREATE TABLE public.bitmap_storefront_listings (
  offer_id uuid PRIMARY KEY REFERENCES public.offers(id) ON DELETE CASCADE,
  storefront_height integer NOT NULL CHECK (storefront_height >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitmap_storefront_listings_height_idx ON public.bitmap_storefront_listings(storefront_height, created_at DESC);
GRANT SELECT ON public.bitmap_storefront_listings TO anon, authenticated;
GRANT ALL ON public.bitmap_storefront_listings TO service_role;
ALTER TABLE public.bitmap_storefront_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Storefront listings are public" ON public.bitmap_storefront_listings FOR SELECT TO anon, authenticated USING (true);