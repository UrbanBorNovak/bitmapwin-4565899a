CREATE TABLE public.biternam_quest_steps (
  user_id uuid NOT NULL,
  quest_id text NOT NULL,
  step_index integer NOT NULL CHECK (step_index >= 0 AND step_index < 64),
  step_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id, step_index)
);
REVOKE ALL ON public.biternam_quest_steps FROM anon, authenticated;
GRANT ALL ON public.biternam_quest_steps TO service_role;
ALTER TABLE public.biternam_quest_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.biternam_quest_steps FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.biternam_quest_claims (
  user_id uuid NOT NULL,
  quest_id text NOT NULL,
  address text NOT NULL,
  bit integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quest_id)
);
REVOKE ALL ON public.biternam_quest_claims FROM anon, authenticated;
GRANT ALL ON public.biternam_quest_claims TO service_role;
ALTER TABLE public.biternam_quest_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.biternam_quest_claims FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Keep earlier payouts counted as claimed.
INSERT INTO public.biternam_quest_claims (user_id, quest_id, address, bit, created_at)
SELECT DISTINCT ON (split_part(ref, ':', 3), split_part(ref, ':', 2))
  split_part(ref, ':', 3)::uuid, split_part(ref, ':', 2), address, delta::integer, created_at
FROM public.coin_ledger
WHERE reason = 'biternam_quest' AND ref ~ '^quest:[^:]+:[0-9a-f-]{36}$'
ORDER BY split_part(ref, ':', 3), split_part(ref, ':', 2), created_at
ON CONFLICT DO NOTHING;

-- Ordered step recording: only the next step, at least 2s after the previous one.
CREATE OR REPLACE FUNCTION public.biternam_record_step(_user uuid, _quest text, _index integer, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer; last_at timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bq:' || _user::text || ':' || _quest));
  SELECT count(*), max(created_at) INTO n, last_at FROM biternam_quest_steps WHERE user_id = _user AND quest_id = _quest;
  IF _index < n THEN RETURN 'already'; END IF;
  IF _index > n THEN RETURN 'out_of_order'; END IF;
  IF last_at IS NOT NULL AND now() - last_at < interval '2 seconds' THEN RETURN 'too_fast'; END IF;
  INSERT INTO biternam_quest_steps (user_id, quest_id, step_index, step_key) VALUES (_user, _quest, _index, _key);
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.biternam_record_step(uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biternam_record_step(uuid, text, integer, text) TO service_role;

-- Atomic claim: completion check + claim row + payout in one transaction.
CREATE OR REPLACE FUNCTION public.biternam_claim_quest(_user uuid, _quest text, _steps integer, _address text, _bit integer)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('bq:' || _user::text || ':' || _quest));
  SELECT count(*) INTO n FROM biternam_quest_steps WHERE user_id = _user AND quest_id = _quest AND step_index < _steps;
  IF n < _steps THEN
    IF EXISTS (SELECT 1 FROM biternam_quest_claims WHERE user_id = _user AND quest_id = _quest) THEN RETURN 'already'; END IF;
    RETURN 'incomplete';
  END IF;
  INSERT INTO biternam_quest_claims (user_id, quest_id, address, bit) VALUES (_user, _quest, _address, _bit)
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 'already'; END IF;
  PERFORM coin_apply(_address, _bit, 'biternam_quest', 'quest:' || _quest || ':' || _user::text);
  RETURN 'paid';
END $$;
REVOKE ALL ON FUNCTION public.biternam_claim_quest(uuid, text, integer, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.biternam_claim_quest(uuid, text, integer, text, integer) TO service_role;