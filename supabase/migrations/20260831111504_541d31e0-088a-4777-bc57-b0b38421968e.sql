CREATE TABLE public.bitmap_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_height bigint NOT NULL,
  visitor_key text NOT NULL,
  viewer_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitmap_views_height_idx ON public.bitmap_views (bitmap_height);
CREATE INDEX bitmap_views_visitor_idx ON public.bitmap_views (bitmap_height, visitor_key);

GRANT SELECT ON public.bitmap_views TO anon;
GRANT SELECT ON public.bitmap_views TO authenticated;
GRANT ALL ON public.bitmap_views TO service_role;
ALTER TABLE public.bitmap_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY bitmap_views_public_read ON public.bitmap_views FOR SELECT USING (true);

CREATE TABLE public.bitmap_view_stats (
  bitmap_height bigint NOT NULL PRIMARY KEY,
  total_views bigint NOT NULL DEFAULT 0,
  unique_visitors bigint NOT NULL DEFAULT 0,
  last_viewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bitmap_view_stats_total_idx ON public.bitmap_view_stats (total_views DESC);

GRANT SELECT ON public.bitmap_view_stats TO anon;
GRANT SELECT ON public.bitmap_view_stats TO authenticated;
GRANT ALL ON public.bitmap_view_stats TO service_role;
ALTER TABLE public.bitmap_view_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY bitmap_view_stats_public_read ON public.bitmap_view_stats FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.record_bitmap_view(_height bigint, _visitor text, _address text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_new boolean;
BEGIN
  IF _height IS NULL OR _visitor IS NULL OR length(_visitor) < 8 OR length(_visitor) > 128 THEN
    RETURN;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.bitmap_views
    WHERE bitmap_height = _height AND visitor_key = _visitor
  ) INTO is_new;

  INSERT INTO public.bitmap_views (bitmap_height, visitor_key, viewer_address)
  VALUES (_height, _visitor, nullif(left(coalesce(_address, ''), 120), ''));

  INSERT INTO public.bitmap_view_stats (bitmap_height, total_views, unique_visitors, last_viewed_at)
  VALUES (_height, 1, CASE WHEN is_new THEN 1 ELSE 0 END, now())
  ON CONFLICT (bitmap_height) DO UPDATE
    SET total_views = public.bitmap_view_stats.total_views + 1,
        unique_visitors = public.bitmap_view_stats.unique_visitors + CASE WHEN is_new THEN 1 ELSE 0 END,
        last_viewed_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) TO anon, authenticated, service_role;

CREATE TABLE public.parcel_pages (
  bitmap_height bigint NOT NULL PRIMARY KEY,
  owner_address text NOT NULL,
  title text,
  description text,
  link_url text,
  banner_inscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.parcel_pages TO anon;
GRANT SELECT, INSERT, UPDATE ON public.parcel_pages TO authenticated;
GRANT ALL ON public.parcel_pages TO service_role;
ALTER TABLE public.parcel_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY parcel_pages_public_read ON public.parcel_pages FOR SELECT USING (true);
CREATE POLICY parcel_pages_public_insert ON public.parcel_pages FOR INSERT WITH CHECK (length(owner_address) BETWEEN 16 AND 120);
CREATE POLICY parcel_pages_public_update ON public.parcel_pages FOR UPDATE USING (true) WITH CHECK (length(owner_address) BETWEEN 16 AND 120);

CREATE TRIGGER parcel_pages_updated_at BEFORE UPDATE ON public.parcel_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wallet_profiles (
  address text NOT NULL PRIMARY KEY,
  display_name text,
  bio text,
  avatar_inscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.wallet_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.wallet_profiles TO authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;
ALTER TABLE public.wallet_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY wallet_profiles_public_read ON public.wallet_profiles FOR SELECT USING (true);
CREATE POLICY wallet_profiles_public_insert ON public.wallet_profiles FOR INSERT WITH CHECK (length(address) BETWEEN 16 AND 120);
CREATE POLICY wallet_profiles_public_update ON public.wallet_profiles FOR UPDATE USING (true) WITH CHECK (length(address) BETWEEN 16 AND 120);

CREATE TRIGGER wallet_profiles_updated_at BEFORE UPDATE ON public.wallet_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();