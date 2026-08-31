CREATE TABLE public.districts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  owner_address text NOT NULL,
  name text NOT NULL,
  description text,
  accent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.districts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.districts TO authenticated;
GRANT ALL ON public.districts TO service_role;

ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "districts_public_read" ON public.districts FOR SELECT USING (true);
CREATE POLICY "districts_owner_insert" ON public.districts FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));
CREATE POLICY "districts_owner_update" ON public.districts FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address))
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));
CREATE POLICY "districts_owner_delete" ON public.districts FOR DELETE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address));

CREATE TRIGGER update_districts_updated_at BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.district_bitmaps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  district_id uuid NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  bitmap_height bigint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (district_id, bitmap_height)
);

CREATE INDEX district_bitmaps_height_idx ON public.district_bitmaps (bitmap_height);

GRANT SELECT ON public.district_bitmaps TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.district_bitmaps TO authenticated;
GRANT ALL ON public.district_bitmaps TO service_role;

ALTER TABLE public.district_bitmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "district_bitmaps_public_read" ON public.district_bitmaps FOR SELECT USING (true);
CREATE POLICY "district_bitmaps_owner_insert" ON public.district_bitmaps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.districts d
    WHERE d.id = district_id AND public.owns_wallet(auth.uid(), d.owner_address)
  ));
CREATE POLICY "district_bitmaps_owner_delete" ON public.district_bitmaps FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.districts d
    WHERE d.id = district_id AND public.owns_wallet(auth.uid(), d.owner_address)
  ));

CREATE TABLE public.build_delegates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_height bigint NOT NULL,
  owner_address text NOT NULL,
  delegate_address text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (bitmap_height, delegate_address)
);

CREATE INDEX build_delegates_delegate_idx ON public.build_delegates (delegate_address);

GRANT SELECT ON public.build_delegates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_delegates TO authenticated;
GRANT ALL ON public.build_delegates TO service_role;

ALTER TABLE public.build_delegates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "build_delegates_public_read" ON public.build_delegates FOR SELECT USING (true);
CREATE POLICY "build_delegates_owner_insert" ON public.build_delegates FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));
CREATE POLICY "build_delegates_owner_delete" ON public.build_delegates FOR DELETE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address));

CREATE OR REPLACE FUNCTION public.can_build_bitmap(_user_id uuid, _height bigint, _owner_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.owns_wallet(_user_id, _owner_address)
     OR EXISTS (
       SELECT 1
       FROM public.build_delegates bd
       JOIN public.wallet_links wl ON wl.address = bd.delegate_address
       WHERE bd.bitmap_height = _height
         AND wl.user_id = _user_id
     )
$$;

DROP POLICY IF EXISTS "parcel_pages_owner_insert" ON public.parcel_pages;
DROP POLICY IF EXISTS "parcel_pages_owner_update" ON public.parcel_pages;

CREATE POLICY "parcel_pages_builder_insert" ON public.parcel_pages FOR INSERT TO authenticated
  WITH CHECK (public.can_build_bitmap(auth.uid(), bitmap_height, owner_address));
CREATE POLICY "parcel_pages_builder_update" ON public.parcel_pages FOR UPDATE TO authenticated
  USING (public.can_build_bitmap(auth.uid(), bitmap_height, owner_address))
  WITH CHECK (public.can_build_bitmap(auth.uid(), bitmap_height, owner_address));