CREATE TABLE public.bss_block_scan (
  block_height BIGINT PRIMARY KEY,
  inscriptions_seen INTEGER NOT NULL DEFAULT 0,
  bmp_seen INTEGER NOT NULL DEFAULT 0,
  scenes_found INTEGER NOT NULL DEFAULT 0,
  scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bss_block_scan TO anon;
GRANT SELECT ON public.bss_block_scan TO authenticated;
GRANT ALL ON public.bss_block_scan TO service_role;

ALTER TABLE public.bss_block_scan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Block sweep record is public" ON public.bss_block_scan FOR SELECT USING (true);

CREATE INDEX bss_block_scan_scanned_at_idx ON public.bss_block_scan (scanned_at DESC);

CREATE TRIGGER update_bss_block_scan_updated_at
BEFORE UPDATE ON public.bss_block_scan
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();