CREATE OR REPLACE FUNCTION public.validate_build_kind()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.build_kind NOT IN ('info', 'gallery', 'game3d', 'game2d', 'shop', 'myspace') THEN
    RAISE EXCEPTION 'invalid build_kind: %', NEW.build_kind;
  END IF;
  RETURN NEW;
END;
$$;