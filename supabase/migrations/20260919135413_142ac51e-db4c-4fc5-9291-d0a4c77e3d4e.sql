-- Signed transaction/message data must not be publicly readable.
revoke select on public.offers from anon, authenticated;
grant select (
  id, psbt_hash, bitmap_height, inscription_id, outpoint, seller_address,
  price_sats, status, created_at, updated_at, buyer_address, delivered_at,
  delivery_note, buyer_txid, bid_id
) on public.offers to anon, authenticated;

revoke select on public.bids from anon, authenticated;
grant select (
  id, bitmap_height, bidder_address, price_sats, expires_at, note, status,
  created_at, updated_at, accepted_offer_id
) on public.bids to anon, authenticated;

grant all on public.offers to service_role;
grant all on public.bids to service_role;