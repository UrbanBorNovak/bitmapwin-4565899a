-- 1) Money/state-changing SECURITY DEFINER functions must only run from trusted server code.
REVOKE ALL ON FUNCTION public.coin_apply(text, bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_spend(text, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_create_event(text, text, text, bigint, text, text, bigint, bigint, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_enter_event(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_draw_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_close_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.coin_start_lease(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_claim(text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_ensure_code(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_pay_override(text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_bitmap_view(bigint, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.coin_apply(text, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_spend(text, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_create_event(text, text, text, bigint, text, text, bigint, bigint, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_enter_event(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_draw_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_close_event(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.coin_start_lease(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_claim(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_ensure_code(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_pay_override(text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_bitmap_view(bigint, text, text) TO service_role;

-- Read-only ownership helpers stay callable: row-level policies evaluate them as the caller.
GRANT EXECUTE ON FUNCTION public.owns_wallet(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owns_wallet_address(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) TO authenticated, service_role;

-- 2) Hide the internal account id on public profiles while keeping public profile fields readable.
REVOKE SELECT ON public.wallet_profiles FROM anon, authenticated;
GRANT SELECT (address, display_name, bio, avatar_inscription_id, created_at, updated_at)
  ON public.wallet_profiles TO anon, authenticated;
GRANT ALL ON public.wallet_profiles TO service_role;