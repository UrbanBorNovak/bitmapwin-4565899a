CREATE UNIQUE INDEX speed_bounties_one_open ON public.speed_bounties ((true)) WHERE status = 'open';

CREATE OR REPLACE FUNCTION public.speed_bounty_next_round(
  _label text, _pub_hex text, _lo_hex text, _hi_hex text, _jumps int, _dp_bits int, _herd int, _seed text, _expect_current uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cur uuid; _id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('speed_bounty_round'));
  SELECT id INTO _cur FROM speed_bounties ORDER BY created_at DESC LIMIT 1;
  -- A duplicate click or a second admin raced us: the round they saw is already replaced.
  IF _cur IS DISTINCT FROM _expect_current THEN RETURN NULL; END IF;
  UPDATE speed_bounties SET status = 'closed' WHERE status = 'open';
  INSERT INTO speed_bounties (label, pub_hex, lo_hex, hi_hex, jumps, dp_bits, herd, seed, funded)
  VALUES (_label, _pub_hex, _lo_hex, _hi_hex, _jumps, _dp_bits, _herd, _seed, false) RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.speed_bounty_next_round(text,text,text,text,int,int,int,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.speed_bounty_next_round(text,text,text,text,int,int,int,text,uuid) TO service_role;