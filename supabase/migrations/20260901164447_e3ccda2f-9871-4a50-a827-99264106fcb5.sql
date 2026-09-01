-- Referral codes: one shareable code per verified wallet address
CREATE TABLE public.referral_codes (
  code text PRIMARY KEY,
  owner_address text NOT NULL UNIQUE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.referral_codes TO authenticated;
GRANT ALL ON public.referral_codes TO service_role;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referral_codes_owner_read" ON public.referral_codes
  FOR SELECT TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address));

-- Referrals: who invited whom
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.referral_codes(code) ON DELETE CASCADE,
  referrer_address text NOT NULL,
  referee_address text NOT NULL UNIQUE,
  referee_user_id uuid,
  bonus_paid bigint NOT NULL DEFAULT 0,
  override_earned bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_address);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_participants_read" ON public.referrals
  FOR SELECT TO authenticated
  USING (
    public.owns_wallet(auth.uid(), referrer_address)
    OR public.owns_wallet(auth.uid(), referee_address)
  );

-- Issues (or returns) the referral code for an address
CREATE OR REPLACE FUNCTION public.referral_ensure_code(_user_id uuid, _address text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _try int := 0;
BEGIN
  SELECT code INTO _code FROM public.referral_codes WHERE owner_address = _address;
  IF _code IS NOT NULL THEN
    RETURN _code;
  END IF;

  LOOP
    _try := _try + 1;
    _code := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 8));
    _code := regexp_replace(_code, '[^A-Z0-9]', '', 'g');
    IF length(_code) >= 6 THEN
      _code := substr(_code, 1, 6);
      BEGIN
        INSERT INTO public.referral_codes (code, owner_address, user_id)
        VALUES (_code, _address, _user_id);
        RETURN _code;
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;
    IF _try > 20 THEN
      RAISE EXCEPTION 'Could not allocate a referral code';
    END IF;
  END LOOP;
END;
$$;

-- Claims a referral code: pays the joining bonus to both sides once
CREATE OR REPLACE FUNCTION public.referral_claim(_code text, _user_id uuid, _address text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer text;
  _id uuid;
  _referrer_bonus bigint := 1000;
  _referee_bonus bigint := 500;
BEGIN
  SELECT owner_address INTO _referrer
  FROM public.referral_codes
  WHERE code = upper(trim(_code));

  IF _referrer IS NULL THEN
    RAISE EXCEPTION 'Referral code not found';
  END IF;
  IF _referrer = _address THEN
    RAISE EXCEPTION 'You cannot refer yourself';
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_address = _address) THEN
    RAISE EXCEPTION 'This address already used a referral code';
  END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referee_address = _referrer AND referrer_address = _address) THEN
    RAISE EXCEPTION 'Circular referrals are not allowed';
  END IF;

  INSERT INTO public.referrals (code, referrer_address, referee_address, referee_user_id, bonus_paid)
  VALUES (upper(trim(_code)), _referrer, _address, _user_id, _referrer_bonus)
  RETURNING id INTO _id;

  PERFORM public.coin_apply(_referrer, _referrer_bonus, 'referral_bonus', _id::text);
  PERFORM public.coin_apply(_address, _referee_bonus, 'referral_joined', _id::text);

  RETURN _id;
END;
$$;

-- Pays a referrer their share of a referee's earnings
CREATE OR REPLACE FUNCTION public.referral_pay_override(_referee_address text, _amount bigint, _ref text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.referrals;
BEGIN
  IF _amount <= 0 THEN RETURN 0; END IF;
  SELECT * INTO _row FROM public.referrals WHERE referee_address = _referee_address;
  IF _row.id IS NULL THEN RETURN 0; END IF;

  PERFORM public.coin_apply(_row.referrer_address, _amount, 'referral_override', _ref);
  UPDATE public.referrals
  SET override_earned = override_earned + _amount
  WHERE id = _row.id;
  RETURN _amount;
END;
$$;