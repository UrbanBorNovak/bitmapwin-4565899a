CREATE TABLE public.bitmap_models (
  bitmap_height bigint PRIMARY KEY CHECK (bitmap_height >= 0 AND bitmap_height < 1000000),
  owner_address text NOT NULL,
  inscription_id text NOT NULL CHECK (inscription_id ~ '^[0-9a-fA-F]{64}i[0-9]+$'),
  scale numeric NOT NULL DEFAULT 1 CHECK (scale >= 0.1 AND scale <= 4),
  rotation_y numeric NOT NULL DEFAULT 0 CHECK (rotation_y >= -6.283185307 AND rotation_y <= 6.283185307),
  height_offset numeric NOT NULL DEFAULT 0 CHECK (height_offset >= 0 AND height_offset <= 2),
  validation_status text NOT NULL DEFAULT 'approved' CHECK (validation_status IN ('approved', 'rejected')),
  content_type text NOT NULL,
  body_bytes integer NOT NULL CHECK (body_bytes > 0 AND body_bytes <= 2097152),
  triangle_count integer NOT NULL CHECK (triangle_count >= 0 AND triangle_count <= 100000),
  texture_count integer NOT NULL CHECK (texture_count >= 0 AND texture_count <= 8),
  animation_count integer NOT NULL CHECK (animation_count >= 0 AND animation_count <= 4),
  validation_note text,
  validated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bitmap_models TO anon, authenticated;
GRANT ALL ON public.bitmap_models TO service_role;

ALTER TABLE public.bitmap_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY bitmap_models_public_read_approved
ON public.bitmap_models
FOR SELECT
TO anon, authenticated
USING (validation_status = 'approved');

CREATE INDEX bitmap_models_height_status_idx
ON public.bitmap_models (bitmap_height, validation_status);

CREATE TRIGGER update_bitmap_models_updated_at
BEFORE UPDATE ON public.bitmap_models
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();