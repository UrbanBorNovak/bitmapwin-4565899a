CREATE TABLE public.ui_translations (
  lang TEXT NOT NULL,
  source_key TEXT NOT NULL,
  source TEXT NOT NULL,
  translated TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, source_key)
);

GRANT SELECT ON public.ui_translations TO anon;
GRANT SELECT ON public.ui_translations TO authenticated;
GRANT ALL ON public.ui_translations TO service_role;

ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached interface translations"
ON public.ui_translations FOR SELECT TO anon, authenticated USING (true);