REVOKE ALL ON FUNCTION public.referral_ensure_code(uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_claim(text, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_pay_override(text, bigint, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.referral_ensure_code(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_claim(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_pay_override(text, bigint, text) TO service_role;