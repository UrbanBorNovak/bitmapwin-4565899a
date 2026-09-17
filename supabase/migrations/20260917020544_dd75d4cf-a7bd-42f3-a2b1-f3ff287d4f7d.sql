DROP FUNCTION IF EXISTS public.membership_badge(text);

CREATE TABLE IF NOT EXISTS public.membership_badges (
  address text PRIMARY KEY,
  active boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.membership_badges TO anon, authenticated;
GRANT ALL ON public.membership_badges TO service_role;

ALTER TABLE public.membership_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges are public" ON public.membership_badges;
CREATE POLICY "Badges are public"
ON public.membership_badges FOR SELECT TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.sync_membership_badge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.membership_badges (address, active, expires_at, updated_at)
  VALUES (
    NEW.address,
    NEW.status = 'active' AND NEW.expires_at IS NOT NULL AND NEW.expires_at > now(),
    NEW.expires_at,
    now()
  )
  ON CONFLICT (address) DO UPDATE
    SET active = EXCLUDED.active,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_membership_badge() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS sync_membership_badge_trigger ON public.memberships;
CREATE TRIGGER sync_membership_badge_trigger
AFTER INSERT OR UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.sync_membership_badge();

INSERT INTO public.membership_badges (address, active, expires_at, updated_at)
SELECT m.address,
       m.status = 'active' AND m.expires_at IS NOT NULL AND m.expires_at > now(),
       m.expires_at,
       now()
FROM public.memberships m
ON CONFLICT (address) DO UPDATE
  SET active = EXCLUDED.active, expires_at = EXCLUDED.expires_at, updated_at = now();