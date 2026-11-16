CREATE TABLE public.stake_pilot_watchdog_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  burn_height integer NOT NULL,
  checked integer NOT NULL DEFAULT 0,
  suspicious integer NOT NULL DEFAULT 0,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  contract_paused boolean,
  pause_txid text,
  error text,
  network text NOT NULL DEFAULT 'testnet' CHECK (network = 'testnet')
);
CREATE INDEX stake_pilot_watchdog_ran_idx ON public.stake_pilot_watchdog_runs (ran_at DESC);
REVOKE ALL ON public.stake_pilot_watchdog_runs FROM anon, authenticated;
GRANT ALL ON public.stake_pilot_watchdog_runs TO service_role;
ALTER TABLE public.stake_pilot_watchdog_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.stake_pilot_watchdog_runs FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);