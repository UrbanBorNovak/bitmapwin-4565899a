create or replace function public.map_owners(_row_from bigint, _row_to bigint, _col_from bigint, _col_to bigint)
returns table(block_height bigint, owner_address text)
language sql
stable
security definer
set search_path = public
as $$
  select b.block_height, b.owner_address
  from public.bitmap_index b
  where b.owner_address is not null
    and b.block_height between (_row_from * 10000 + _col_from) and (_row_to * 10000 + _col_to)
    and (b.block_height % 10000) between _col_from and _col_to
  limit 80000;
$$;

grant execute on function public.map_owners(bigint, bigint, bigint, bigint) to anon, authenticated, service_role;