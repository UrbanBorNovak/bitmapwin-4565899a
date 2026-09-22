CREATE TABLE public.bitmap_land_skins (
  bitmap_height BIGINT NOT NULL PRIMARY KEY,
  bitmap_inscription_id TEXT,
  image_inscription_id TEXT,
  content_type TEXT,
  has_image BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bitmap_land_skins TO anon;
GRANT SELECT ON public.bitmap_land_skins TO authenticated;
GRANT ALL ON public.bitmap_land_skins TO service_role;

ALTER TABLE public.bitmap_land_skins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Painted land is public" ON public.bitmap_land_skins FOR SELECT USING (true);