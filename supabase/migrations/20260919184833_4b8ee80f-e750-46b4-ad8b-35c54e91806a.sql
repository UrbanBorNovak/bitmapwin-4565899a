-- Link the operator's own character to their verified wallet so the
-- public profile page can resolve their share book.
update public.rank_players
set user_id = '368a191d-20ad-40ae-b156-a1d435fbb664',
    wallet = 'bc1qgunjcn7a7njky4xzj4ahj79cg6muzj4qg5pfpv'
where lower(name) = 'crt'
  and user_id is null
  and wallet is null;