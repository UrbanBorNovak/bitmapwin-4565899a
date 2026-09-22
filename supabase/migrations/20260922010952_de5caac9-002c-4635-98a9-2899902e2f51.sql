CREATE TABLE public.bss_scan_state (
  bitmap_height BIGINT PRIMARY KEY,
  outcome TEXT NOT NULL DEFAULT 'pending',
  detail TEXT,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bss_scan_state TO anon;
GRANT SELECT ON public.bss_scan_state TO authenticated;
GRANT ALL ON public.bss_scan_state TO service_role;

ALTER TABLE public.bss_scan_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scan record is public" ON public.bss_scan_state FOR SELECT USING (true);

CREATE INDEX bss_scan_state_scanned_at_idx ON public.bss_scan_state (scanned_at DESC);
CREATE INDEX bss_scan_state_outcome_idx ON public.bss_scan_state (outcome);

CREATE TRIGGER update_bss_scan_state_updated_at
BEFORE UPDATE ON public.bss_scan_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();