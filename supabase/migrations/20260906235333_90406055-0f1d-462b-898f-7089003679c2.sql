revoke execute on function public.owns_wallet_address(text) from public, anon;
grant execute on function public.owns_wallet_address(text) to authenticated, service_role;