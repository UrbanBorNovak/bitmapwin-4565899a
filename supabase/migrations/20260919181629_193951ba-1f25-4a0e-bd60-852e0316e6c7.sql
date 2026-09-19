REVOKE ALL ON FUNCTION public.player_stock_dividend_hook() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_stock_dividend_hook() TO service_role;
