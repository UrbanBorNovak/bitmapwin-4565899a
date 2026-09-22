CREATE TABLE public.bitmap_bss_scenes (
  bitmap_height bigint PRIMARY KEY,
  bmp_inscription_id text NOT NULL,
  version_label text NOT NULL,
  object_count integer NOT NULL DEFAULT 0,
  resource_count integer NOT NULL DEFAULT 0,
  is_valid boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT bitmap_bss_scenes_height_nonnegative CHECK (bitmap_height >= 0),
  CONSTRAINT bitmap_bss_scenes_inscription_format CHECK (bmp_inscription_id ~ '^[0-9a-fA-F]{64}i[0-9]+$'),
  CONSTRAINT bitmap_bss_scenes_counts_nonnegative CHECK (object_count >= 0 AND resource_count >= 0)
);

GRANT SELECT ON public.bitmap_bss_scenes TO anon, authenticated;
GRANT ALL ON public.bitmap_bss_scenes TO service_role;

ALTER TABLE public.bitmap_bss_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Validated BSS scenes are publicly readable"
ON public.bitmap_bss_scenes
FOR SELECT
TO anon, authenticated
USING (is_valid = true);

CREATE TRIGGER touch_bitmap_bss_scenes
BEFORE UPDATE ON public.bitmap_bss_scenes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.bitmap_bss_scenes (
  bitmap_height,
  bmp_inscription_id,
  version_label,
  object_count,
  resource_count,
  is_valid,
  verified_at
) VALUES (
  156700,
  '676ddb94c0b30fbb20b7e322a80bd0ea520d68453048c94b7e2acf1ffdb1c953i0',
  '0.0.14',
  62,
  62,
  true,
  now()
);