GRANT SELECT, INSERT ON public.bids TO anon;
GRANT SELECT, INSERT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bids'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bids';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bids_height_idx ON public.bids (bitmap_height, status, price_sats DESC);
CREATE INDEX IF NOT EXISTS bids_bidder_idx ON public.bids (bidder_address, created_at DESC);