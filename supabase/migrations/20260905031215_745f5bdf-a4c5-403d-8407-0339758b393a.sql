REVOKE ALL ON FUNCTION public.coin_spend(text, integer, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.coin_spend(text, integer, text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.coin_spend(text, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.coin_spend(text, integer, text, text) TO service_role;