DROP INDEX IF EXISTS public.memberships_invoice_sats_key;
CREATE UNIQUE INDEX memberships_positive_invoice_sats_key
ON public.memberships (invoice_sats)
WHERE invoice_sats > 0;