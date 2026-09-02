REVOKE ALL ON FUNCTION public.referral_claim(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_ensure_code(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.referral_pay_override(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.referral_claim(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_ensure_code(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.referral_pay_override(text, bigint, text) TO service_role;