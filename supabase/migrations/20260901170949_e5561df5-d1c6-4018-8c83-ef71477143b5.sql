create or replace function public.referral_ensure_code(_user_id uuid, _address text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  _code text;
  _try int := 0;
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  SELECT code INTO _code FROM public.referral_codes WHERE owner_address = _address;
  IF _code IS NOT NULL THEN
    RETURN _code;
  END IF;

  LOOP
    _try := _try + 1;
    _code := '';
    FOR i IN 1..6 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.referral_codes (code, owner_address, user_id)
      VALUES (_code, _address, _user_id);
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
    IF _try > 20 THEN
      RAISE EXCEPTION 'Could not allocate a referral code';
    END IF;
  END LOOP;
END;
$function$;

revoke all on function public.referral_ensure_code(uuid, text) from anon, authenticated;
grant execute on function public.referral_ensure_code(uuid, text) to service_role;