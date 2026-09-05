ALTER TABLE public.extenders ADD COLUMN IF NOT EXISTS price_bit integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.coin_spend(_address text, _amount integer, _reason text, _ref text DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance bigint;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  INSERT INTO public.coin_balances (address, balance, earned_total)
  VALUES (_address, 0, 0)
  ON CONFLICT (address) DO NOTHING;

  SELECT balance INTO _balance FROM public.coin_balances WHERE address = _address FOR UPDATE;

  IF _balance < _amount THEN
    RAISE EXCEPTION 'Not enough BIT: balance %, needed %', _balance, _amount;
  END IF;

  UPDATE public.coin_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE address = _address
  RETURNING balance INTO _balance;

  INSERT INTO public.coin_ledger (address, delta, reason, ref)
  VALUES (_address, -_amount, _reason, _ref);

  RETURN _balance;
END;
$$;

REVOKE ALL ON FUNCTION public.coin_spend(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coin_spend(text, integer, text, text) TO service_role;