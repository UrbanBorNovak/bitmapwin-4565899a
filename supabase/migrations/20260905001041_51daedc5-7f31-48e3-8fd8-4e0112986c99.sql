CREATE TYPE public.extender_status AS ENUM ('draft','published','archived');
CREATE TYPE public.extender_monetization AS ENUM ('free','paid','lease');
CREATE TYPE public.land_permission AS ENUM ('view','enter','build','edit','deploy','manage','lease','monetize');

CREATE TABLE public.extenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'world-systems',
  tags text[] NOT NULL DEFAULT '{}',
  creator_user_id uuid NOT NULL,
  creator_address text,
  icon_inscription_id text,
  preview_inscription_id text,
  status public.extender_status NOT NULL DEFAULT 'draft',
  is_ai_built boolean NOT NULL DEFAULT false,
  license text NOT NULL DEFAULT 'all-rights-reserved',
  monetization public.extender_monetization NOT NULL DEFAULT 'free',
  price_sats bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extenders TO authenticated;
GRANT SELECT ON public.extenders TO anon;
GRANT ALL ON public.extenders TO service_role;
ALTER TABLE public.extenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extenders public read published" ON public.extenders FOR SELECT USING (status = 'published');
CREATE POLICY "extenders creator read" ON public.extenders FOR SELECT TO authenticated USING (creator_user_id = auth.uid());
CREATE POLICY "extenders creator insert" ON public.extenders FOR INSERT TO authenticated WITH CHECK (creator_user_id = auth.uid());
CREATE POLICY "extenders creator update" ON public.extenders FOR UPDATE TO authenticated USING (creator_user_id = auth.uid()) WITH CHECK (creator_user_id = auth.uid());
CREATE POLICY "extenders creator delete" ON public.extenders FOR DELETE TO authenticated USING (creator_user_id = auth.uid() AND status <> 'published');

CREATE TABLE public.extender_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extender_id uuid NOT NULL REFERENCES public.extenders(id) ON DELETE CASCADE,
  semver text NOT NULL,
  sdk_version text NOT NULL DEFAULT '0.1',
  changelog text NOT NULL DEFAULT '',
  manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.extender_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (extender_id, semver)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extender_versions TO authenticated;
GRANT SELECT ON public.extender_versions TO anon;
GRANT ALL ON public.extender_versions TO service_role;
ALTER TABLE public.extender_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions public read published" ON public.extender_versions FOR SELECT USING (
  status = 'published' AND EXISTS (SELECT 1 FROM public.extenders e WHERE e.id = extender_id AND e.status = 'published')
);
CREATE POLICY "versions creator all" ON public.extender_versions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.extenders e WHERE e.id = extender_id AND e.creator_user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.extenders e WHERE e.id = extender_id AND e.creator_user_id = auth.uid())
);

CREATE TABLE public.extender_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.extender_versions(id) ON DELETE CASCADE,
  depends_on_extender_id uuid NOT NULL REFERENCES public.extenders(id) ON DELETE RESTRICT,
  version_range text NOT NULL DEFAULT '*',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, depends_on_extender_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extender_dependencies TO authenticated;
GRANT SELECT ON public.extender_dependencies TO anon;
GRANT ALL ON public.extender_dependencies TO service_role;
ALTER TABLE public.extender_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deps public read" ON public.extender_dependencies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND v.status = 'published' AND e.status = 'published'
  )
);
CREATE POLICY "deps creator all" ON public.extender_dependencies FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND e.creator_user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND e.creator_user_id = auth.uid()
  )
);

CREATE TABLE public.extender_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.extender_versions(id) ON DELETE CASCADE,
  permission public.land_permission NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (version_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extender_permissions TO authenticated;
GRANT SELECT ON public.extender_permissions TO anon;
GRANT ALL ON public.extender_permissions TO service_role;
ALTER TABLE public.extender_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perms public read" ON public.extender_permissions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND v.status = 'published' AND e.status = 'published'
  )
);
CREATE POLICY "perms creator all" ON public.extender_permissions FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND e.creator_user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.extender_versions v JOIN public.extenders e ON e.id = v.extender_id
    WHERE v.id = version_id AND e.creator_user_id = auth.uid()
  )
);

CREATE TABLE public.extender_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extender_id uuid NOT NULL REFERENCES public.extenders(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES public.extender_versions(id) ON DELETE CASCADE,
  bitmap_height integer NOT NULL,
  deployed_by_user_id uuid NOT NULL,
  deployed_by_address text NOT NULL,
  granted_via text NOT NULL DEFAULT 'owner',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bitmap_height, extender_id)
);
GRANT SELECT ON public.extender_deployments TO authenticated, anon;
GRANT ALL ON public.extender_deployments TO service_role;
ALTER TABLE public.extender_deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deployments public read active" ON public.extender_deployments FOR SELECT USING (status = 'active');
CREATE POLICY "deployments deployer read" ON public.extender_deployments FOR SELECT TO authenticated USING (deployed_by_user_id = auth.uid());
CREATE INDEX extender_deployments_height_idx ON public.extender_deployments (bitmap_height);

CREATE TABLE public.land_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bitmap_height integer NOT NULL,
  owner_user_id uuid NOT NULL,
  owner_address text NOT NULL,
  grantee_address text NOT NULL,
  grantee_user_id uuid,
  permissions public.land_permission[] NOT NULL DEFAULT '{}',
  note text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bitmap_height, grantee_address)
);
GRANT SELECT ON public.land_grants TO authenticated;
GRANT ALL ON public.land_grants TO service_role;
ALTER TABLE public.land_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grants owner read" ON public.land_grants FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR grantee_user_id = auth.uid());
CREATE INDEX land_grants_height_idx ON public.land_grants (bitmap_height);

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  banner_inscription_id text,
  founder_user_id uuid NOT NULL,
  founder_address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cities TO authenticated, anon;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cities public read" ON public.cities FOR SELECT USING (true);

CREATE TABLE public.city_bitmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  bitmap_height integer NOT NULL,
  member_address text NOT NULL,
  member_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, bitmap_height)
);
GRANT SELECT ON public.city_bitmaps TO authenticated, anon;
GRANT ALL ON public.city_bitmaps TO service_role;
ALTER TABLE public.city_bitmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "city bitmaps public read" ON public.city_bitmaps FOR SELECT USING (true);

CREATE VIEW public.extender_public_stats
WITH (security_invoker = true) AS
SELECT
  e.id AS extender_id,
  (SELECT count(*) FROM public.extender_versions v WHERE v.extender_id = e.id AND v.status = 'published') AS published_versions,
  (SELECT count(*) FROM public.extender_deployments d WHERE d.extender_id = e.id AND d.status = 'active') AS active_deployments,
  (SELECT max(v.published_at) FROM public.extender_versions v WHERE v.extender_id = e.id AND v.status = 'published') AS last_published_at
FROM public.extenders e;
GRANT SELECT ON public.extender_public_stats TO authenticated, anon, service_role;

CREATE TRIGGER extenders_updated_at BEFORE UPDATE ON public.extenders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();