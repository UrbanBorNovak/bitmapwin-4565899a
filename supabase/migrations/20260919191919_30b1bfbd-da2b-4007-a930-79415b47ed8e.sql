REVOKE EXECUTE ON FUNCTION public.player_stock_issue(text, uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.player_stock_trade(text, uuid, text, integer) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.player_stock_issue(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.player_stock_trade(text, uuid, text, integer) TO service_role;