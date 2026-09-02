DROP POLICY IF EXISTS wallet_links_public_read ON public.wallet_links;
CREATE POLICY wallet_links_owner_read ON public.wallet_links
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.referral_claim(text, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_ensure_code(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.referral_pay_override(text, bigint, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_claim(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_ensure_code(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_pay_override(text, bigint, text) TO service_role;