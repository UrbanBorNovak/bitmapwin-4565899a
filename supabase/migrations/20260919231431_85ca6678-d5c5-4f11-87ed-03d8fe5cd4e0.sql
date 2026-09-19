CREATE OR REPLACE FUNCTION public.has_passport_unlock(_user_id uuid, _capability_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.passport_unlocks
    WHERE user_id = _user_id
      AND capability_key = _capability_key
  )
$$;
REVOKE ALL ON FUNCTION public.has_passport_unlock(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_passport_unlock(uuid, text) TO authenticated, service_role;