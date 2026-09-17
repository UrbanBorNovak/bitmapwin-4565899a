REVOKE ALL ON FUNCTION public.market_list_goods(text, text, integer, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_buy_listing(text, uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_cancel_listing(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.market_npc_tick() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.market_list_goods(text, text, integer, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_buy_listing(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_cancel_listing(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.market_npc_tick() TO service_role;