CREATE TABLE public.inscription_donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inscription_id text NOT NULL UNIQUE,
  donor_address text NOT NULL,
  donor_user_id uuid NOT NULL,
  txid text,
  sats bigint NOT NULL DEFAULT 0,
  bits_awarded bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'credited',
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX inscription_donations_donor_idx ON public.inscription_donations (donor_address, created_at DESC);

GRANT SELECT ON public.inscription_donations TO authenticated;
GRANT ALL ON public.inscription_donations TO service_role;

ALTER TABLE public.inscription_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Donors read their own donations"
  ON public.inscription_donations
  FOR SELECT
  TO authenticated
  USING (public.owns_wallet_address(donor_address));

CREATE TRIGGER inscription_donations_updated_at
  BEFORE UPDATE ON public.inscription_donations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
