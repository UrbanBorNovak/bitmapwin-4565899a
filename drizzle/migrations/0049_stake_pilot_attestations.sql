CREATE TABLE public.stake_pilot_attestations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  height integer NOT NULL,
  btc_address text NOT NULL,
  stx_address text NOT NULL,
  weight integer NOT NULL,
  epoch integer NOT NULL,
  issued integer NOT NULL,
  network text NOT NULL DEFAULT 'testnet' CHECK (network = 'testnet'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stake_pilot_att_btc_idx ON public.stake_pilot_attestations (btc_address, created_at DESC);
CREATE INDEX stake_pilot_att_stx_idx ON public.stake_pilot_attestations (stx_address, height, issued);
REVOKE ALL ON public.stake_pilot_attestations FROM anon, authenticated;
GRANT ALL ON public.stake_pilot_attestations TO service_role;
ALTER TABLE public.stake_pilot_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.stake_pilot_attestations FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);