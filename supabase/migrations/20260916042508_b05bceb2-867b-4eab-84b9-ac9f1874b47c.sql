CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invoice_sats integer NOT NULL,
  txid text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX memberships_invoice_sats_key ON public.memberships (invoice_sats);
CREATE INDEX memberships_status_idx ON public.memberships (status);

GRANT SELECT (address, status, expires_at, created_at, updated_at) ON public.memberships TO anon, authenticated;
GRANT ALL ON public.memberships TO service_role;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membership status is public" ON public.memberships
  FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_memberships_updated_at BEFORE UPDATE ON public.memberships
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();