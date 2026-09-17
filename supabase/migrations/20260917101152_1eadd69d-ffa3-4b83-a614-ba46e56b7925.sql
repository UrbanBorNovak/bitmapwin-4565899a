REVOKE EXECUTE ON FUNCTION public.goods_trade(text, text, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.goods_trade(text, text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.goods_trade(text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.goods_trade(text, text, text, integer) TO service_role;