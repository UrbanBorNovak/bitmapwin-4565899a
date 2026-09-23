-- offers: keep listings public but never expose signing payloads
REVOKE SELECT ON public.offers FROM anon, authenticated;
GRANT SELECT (id, bitmap_height, inscription_id, outpoint, seller_address, buyer_address, price_sats, status, created_at, updated_at, delivered_at, bid_id) ON public.offers TO anon, authenticated;

-- bids: hide the raw signature blob
REVOKE SELECT ON public.bids FROM anon, authenticated;
GRANT SELECT (id, bitmap_height, bidder_address, price_sats, expires_at, note, status, created_at, updated_at, accepted_offer_id) ON public.bids TO anon, authenticated;

-- clans: hide the internal leader account id
REVOKE SELECT ON public.clans FROM anon;
GRANT SELECT (id, name, tag, crest_inscription_id, created_at, updated_at) ON public.clans TO anon;

-- rank_players: hide the internal account id
REVOKE SELECT ON public.rank_players FROM anon, authenticated;
GRANT SELECT (id, wallet, name, title, level, fame, karma, pk_kills, pvp_kills, deaths, chaotic_count, status, clan_id, home_bitmap, last_district, last_kill_at, last_death_at, bit_earned, districts_visited, builds_maintained, created_at, updated_at) ON public.rank_players TO anon, authenticated;