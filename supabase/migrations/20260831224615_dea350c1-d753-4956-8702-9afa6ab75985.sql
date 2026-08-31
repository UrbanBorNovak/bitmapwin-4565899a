ALTER TABLE public.parcel_pages
  ADD COLUMN IF NOT EXISTS build_kind text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS build_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.validate_build_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.build_kind NOT IN ('info', 'gallery', 'game3d', 'game2d') THEN
    RAISE EXCEPTION 'invalid build_kind: %', NEW.build_kind;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_build_kind_trigger ON public.parcel_pages;
CREATE TRIGGER validate_build_kind_trigger
  BEFORE INSERT OR UPDATE ON public.parcel_pages
  FOR EACH ROW EXECUTE FUNCTION public.validate_build_kind();