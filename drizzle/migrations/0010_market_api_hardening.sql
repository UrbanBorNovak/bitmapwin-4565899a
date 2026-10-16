CREATE TABLE public.market_api_hits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
GRANT ALL ON public.market_api_hits TO service_role;
REVOKE ALL ON public.market_api_hits FROM anon, authenticated;
ALTER TABLE public.market_api_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.market_api_hits FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.market_api_signatures (
  sig_hash text PRIMARY KEY,
  address text NOT NULL,
  action text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.market_api_signatures TO service_role;
REVOKE ALL ON public.market_api_signatures FROM anon, authenticated;
ALTER TABLE public.market_api_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.market_api_signatures FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Fixed-window counter: returns true while the bucket is under its limit.
CREATE OR REPLACE FUNCTION public.market_api_hit(_bucket text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _start timestamptz := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  _n integer;
BEGIN
  INSERT INTO public.market_api_hits AS h (bucket, window_start, hits)
  VALUES (_bucket, _start, 1)
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = h.hits + 1
  RETURNING hits INTO _n;
  IF random() < 0.01 THEN
    DELETE FROM public.market_api_hits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN _n <= _limit;
END;
$$;

-- Single-use signatures: true the first time a hash is claimed, false on replay.
CREATE OR REPLACE FUNCTION public.market_api_claim_signature(_hash text, _address text, _action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.market_api_signatures (sig_hash, address, action) VALUES (_hash, _address, _action);
  RETURN true;
EXCEPTION WHEN unique_violation THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.market_api_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.market_api_claim_signature(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.market_api_hit(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_api_claim_signature(text, text, text) TO service_role;