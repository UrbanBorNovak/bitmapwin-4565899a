-- 1. Remove blanket authenticated write access; these tables are written server-side only.
DROP POLICY IF EXISTS activity_auth_write ON public.activity;
DROP POLICY IF EXISTS bitmaps_auth_write ON public.bitmaps;
DROP POLICY IF EXISTS listings_auth_write ON public.listings;

REVOKE INSERT, UPDATE, DELETE ON public.activity FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.bitmaps FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.listings FROM authenticated, anon;
GRANT ALL ON public.activity TO service_role;
GRANT ALL ON public.bitmaps TO service_role;
GRANT ALL ON public.listings TO service_role;

-- 2. Inline the wallet-ownership checks so policies no longer require EXECUTE on
--    SECURITY DEFINER helpers.
DROP POLICY IF EXISTS wallet_profiles_owner_insert ON public.wallet_profiles;
CREATE POLICY wallet_profiles_owner_insert ON public.wallet_profiles FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(wallet_profiles.address)));

DROP POLICY IF EXISTS wallet_profiles_owner_update ON public.wallet_profiles;
CREATE POLICY wallet_profiles_owner_update ON public.wallet_profiles FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(wallet_profiles.address)))
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(wallet_profiles.address)));

DROP POLICY IF EXISTS districts_owner_insert ON public.districts;
CREATE POLICY districts_owner_insert ON public.districts FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(districts.owner_address)));

DROP POLICY IF EXISTS districts_owner_update ON public.districts;
CREATE POLICY districts_owner_update ON public.districts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(districts.owner_address)))
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(districts.owner_address)));

DROP POLICY IF EXISTS districts_owner_delete ON public.districts;
CREATE POLICY districts_owner_delete ON public.districts FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(districts.owner_address)));

DROP POLICY IF EXISTS district_bitmaps_owner_insert ON public.district_bitmaps;
CREATE POLICY district_bitmaps_owner_insert ON public.district_bitmaps FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.districts d
  JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(d.owner_address)
  WHERE d.id = district_bitmaps.district_id));

DROP POLICY IF EXISTS district_bitmaps_owner_delete ON public.district_bitmaps;
CREATE POLICY district_bitmaps_owner_delete ON public.district_bitmaps FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.districts d
  JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(d.owner_address)
  WHERE d.id = district_bitmaps.district_id));

DROP POLICY IF EXISTS build_delegates_owner_insert ON public.build_delegates;
CREATE POLICY build_delegates_owner_insert ON public.build_delegates FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(build_delegates.owner_address)));

DROP POLICY IF EXISTS build_delegates_owner_delete ON public.build_delegates;
CREATE POLICY build_delegates_owner_delete ON public.build_delegates FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(build_delegates.owner_address)));

DROP POLICY IF EXISTS lease_offers_owner_insert ON public.lease_offers;
CREATE POLICY lease_offers_owner_insert ON public.lease_offers FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(lease_offers.owner_address)));

DROP POLICY IF EXISTS lease_offers_owner_update ON public.lease_offers;
CREATE POLICY lease_offers_owner_update ON public.lease_offers FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(lease_offers.owner_address)))
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(lease_offers.owner_address)));

DROP POLICY IF EXISTS lease_offers_owner_delete ON public.lease_offers;
CREATE POLICY lease_offers_owner_delete ON public.lease_offers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(lease_offers.owner_address)));

DROP POLICY IF EXISTS coin_events_host_insert ON public.coin_events;
CREATE POLICY coin_events_host_insert ON public.coin_events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(coin_events.host_address)));

DROP POLICY IF EXISTS coin_events_host_update ON public.coin_events;
CREATE POLICY coin_events_host_update ON public.coin_events FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(coin_events.host_address)))
WITH CHECK (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(coin_events.host_address)));

DROP POLICY IF EXISTS referral_codes_owner_read ON public.referral_codes;
CREATE POLICY referral_codes_owner_read ON public.referral_codes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(referral_codes.owner_address)));

DROP POLICY IF EXISTS referrals_participants_read ON public.referrals;
CREATE POLICY referrals_participants_read ON public.referrals FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.wallet_links wl
  WHERE wl.user_id = auth.uid()
    AND (lower(wl.address) = lower(referrals.referrer_address) OR lower(wl.address) = lower(referrals.referee_address))));

DROP POLICY IF EXISTS parcel_pages_builder_insert ON public.parcel_pages;
CREATE POLICY parcel_pages_builder_insert ON public.parcel_pages FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(parcel_pages.owner_address))
  OR EXISTS (SELECT 1 FROM public.build_delegates bd JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(bd.delegate_address) WHERE bd.bitmap_height = parcel_pages.bitmap_height)
  OR EXISTS (SELECT 1 FROM public.leases l JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(l.lessee_address) WHERE l.bitmap_height = parcel_pages.bitmap_height AND l.status = 'active' AND l.ends_at > now()));

DROP POLICY IF EXISTS parcel_pages_builder_update ON public.parcel_pages;
CREATE POLICY parcel_pages_builder_update ON public.parcel_pages FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(parcel_pages.owner_address))
  OR EXISTS (SELECT 1 FROM public.build_delegates bd JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(bd.delegate_address) WHERE bd.bitmap_height = parcel_pages.bitmap_height)
  OR EXISTS (SELECT 1 FROM public.leases l JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(l.lessee_address) WHERE l.bitmap_height = parcel_pages.bitmap_height AND l.status = 'active' AND l.ends_at > now()))
WITH CHECK (
  EXISTS (SELECT 1 FROM public.wallet_links wl WHERE wl.user_id = auth.uid() AND lower(wl.address) = lower(parcel_pages.owner_address))
  OR EXISTS (SELECT 1 FROM public.build_delegates bd JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(bd.delegate_address) WHERE bd.bitmap_height = parcel_pages.bitmap_height)
  OR EXISTS (SELECT 1 FROM public.leases l JOIN public.wallet_links wl ON wl.user_id = auth.uid() AND lower(wl.address) = lower(l.lessee_address) WHERE l.bitmap_height = parcel_pages.bitmap_height AND l.status = 'active' AND l.ends_at > now()));

-- 3. SECURITY DEFINER helpers are trusted-server-only from now on.
REVOKE EXECUTE ON FUNCTION public.owns_wallet(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) TO service_role;