
-- Helper: does the signed-in user control a wallet address?
create or replace function public.owns_wallet_address(_address text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.wallet_links
    where user_id = auth.uid()
      and address = _address
  )
$$;

-- 1. bids: only the bidder (verified wallet link) may update or cancel their bid
create policy "bidders update their own bids"
on public.bids for update to authenticated
using (public.owns_wallet_address(bidder_address))
with check (public.owns_wallet_address(bidder_address));

create policy "bidders delete their own bids"
on public.bids for delete to authenticated
using (public.owns_wallet_address(bidder_address));

-- 2. offers: only seller or buyer (verified wallet link) may modify an offer
create policy "seller or buyer update their offers"
on public.offers for update to authenticated
using (
  public.owns_wallet_address(seller_address)
  or (buyer_address is not null and public.owns_wallet_address(buyer_address))
)
with check (
  public.owns_wallet_address(seller_address)
  or (buyer_address is not null and public.owns_wallet_address(buyer_address))
);

create policy "seller deletes their offers"
on public.offers for delete to authenticated
using (public.owns_wallet_address(seller_address));

-- 3. leases: only owner or lessee (verified wallet link) may write a lease
create policy "owner or lessee insert leases"
on public.leases for insert to authenticated
with check (
  public.owns_wallet_address(owner_address)
  or public.owns_wallet_address(lessee_address)
);

create policy "owner or lessee update leases"
on public.leases for update to authenticated
using (
  public.owns_wallet_address(owner_address)
  or public.owns_wallet_address(lessee_address)
)
with check (
  public.owns_wallet_address(owner_address)
  or public.owns_wallet_address(lessee_address)
);

-- 4. extender_state: shared records are writable only by the deployment owner,
--    not by any signed-in visitor (prevents shared-state takeover / race)
drop policy if exists "signed in visitors update shared extender state" on public.extender_state;
drop policy if exists "signed in visitors write shared extender state" on public.extender_state;

create policy "deployment owners write shared extender state"
on public.extender_state for insert to authenticated
with check (
  (scope = 'player'::text and actor = auth.uid())
  or (
    scope = 'shared'::text
    and actor is null
    and exists (
      select 1 from public.extender_deployments d
      where d.id = deployment_id
        and d.deployed_by_user_id = auth.uid()
    )
  )
);

create policy "deployment owners update shared extender state"
on public.extender_state for update to authenticated
using (
  scope = 'shared'::text
  and exists (
    select 1 from public.extender_deployments d
    where d.id = deployment_id
      and d.deployed_by_user_id = auth.uid()
  )
)
with check (
  scope = 'shared'::text
  and actor is null
  and exists (
    select 1 from public.extender_deployments d
    where d.id = deployment_id
      and d.deployed_by_user_id = auth.uid()
  )
);

drop policy if exists "players write their own extender state" on public.extender_state;
