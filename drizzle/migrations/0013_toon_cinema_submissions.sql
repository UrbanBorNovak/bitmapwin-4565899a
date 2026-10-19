CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE public.toon_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  creator_name text,
  episode jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE INDEX toon_submissions_status_idx ON public.toon_submissions (status, reviewed_at DESC);
GRANT SELECT (id, title, creator_name, episode, status, created_at, reviewed_at) ON public.toon_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.toon_submissions TO authenticated;
GRANT ALL ON public.toon_submissions TO service_role;
ALTER TABLE public.toon_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads approved episodes" ON public.toon_submissions FOR SELECT TO anon USING (status = 'approved');
CREATE POLICY "Creators read own, admins read all" ON public.toon_submissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Creators submit own" ON public.toon_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators withdraw own pending" ON public.toon_submissions FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins review" ON public.toon_submissions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_toon_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF octet_length(NEW.episode::text) > 2000000 THEN RAISE EXCEPTION 'EPISODE TOO LARGE'; END IF;
  IF length(NEW.title) < 1 OR length(NEW.title) > 120 THEN RAISE EXCEPTION 'TITLE MUST BE 1-120 CHARACTERS'; END IF;
  IF NEW.creator_name IS NOT NULL AND length(NEW.creator_name) > 48 THEN RAISE EXCEPTION 'NAME TOO LONG'; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending'; NEW.reviewed_at := NULL; NEW.review_note := NULL; NEW.created_at := now();
  ELSE
    IF NEW.status NOT IN ('pending','approved','rejected') THEN RAISE EXCEPTION 'BAD STATUS'; END IF;
    NEW.user_id := OLD.user_id; NEW.episode := OLD.episode; NEW.created_at := OLD.created_at;
    IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.reviewed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER toon_submissions_validate BEFORE INSERT OR UPDATE ON public.toon_submissions
  FOR EACH ROW EXECUTE FUNCTION public.validate_toon_submission();