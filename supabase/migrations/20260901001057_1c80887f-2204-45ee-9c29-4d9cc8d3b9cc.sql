CREATE TABLE public.lease_offers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_height bigint NOT NULL,
  owner_address text NOT NULL,
  rate_sats_per_day bigint NOT NULL,
  min_days integer NOT NULL DEFAULT 1,
  max_days integer NOT NULL DEFAULT 30,
  note text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (bitmap_height, owner_address)
);

GRANT SELECT ON public.lease_offers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lease_offers TO authenticated;
GRANT ALL ON public.lease_offers TO service_role;

ALTER TABLE public.lease_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_offers_public_read" ON public.lease_offers FOR SELECT USING (true);
CREATE POLICY "lease_offers_owner_insert" ON public.lease_offers FOR INSERT TO authenticated
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));
CREATE POLICY "lease_offers_owner_update" ON public.lease_offers FOR UPDATE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address))
  WITH CHECK (public.owns_wallet(auth.uid(), owner_address));
CREATE POLICY "lease_offers_owner_delete" ON public.lease_offers FOR DELETE TO authenticated
  USING (public.owns_wallet(auth.uid(), owner_address));

CREATE TRIGGER update_lease_offers_updated_at BEFORE UPDATE ON public.lease_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bitmap_height bigint NOT NULL,
  owner_address text NOT NULL,
  lessee_address text NOT NULL,
  rate_sats_per_day bigint NOT NULL,
  days integer NOT NULL,
  total_sats bigint NOT NULL,
  fee_sats bigint NOT NULL DEFAULT 0,
  txid text,
  psbt_base64 text,
  status text NOT NULL DEFAULT 'pending',
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leases TO anon;
GRANT SELECT ON public.leases TO authenticated;
GRANT ALL ON public.leases TO service_role;

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_public_read" ON public.leases FOR SELECT USING (true);

CREATE INDEX leases_height_status_idx ON public.leases (bitmap_height, status);
CREATE INDEX leases_owner_idx ON public.leases (owner_address);
CREATE INDEX leases_lessee_idx ON public.leases (lessee_address);

CREATE TRIGGER update_leases_updated_at BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_build_bitmap(_user_id uuid, _height bigint, _owner_address text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.owns_wallet(_user_id, _owner_address)
     OR EXISTS (
       SELECT 1
       FROM public.build_delegates bd
       JOIN public.wallet_links wl ON wl.address = bd.delegate_address
       WHERE bd.bitmap_height = _height
         AND wl.user_id = _user_id
     )
     OR EXISTS (
       SELECT 1
       FROM public.leases l
       JOIN public.wallet_links wl ON wl.address = l.lessee_address
       WHERE l.bitmap_height = _height
         AND wl.user_id = _user_id
         AND l.status = 'active'
         AND l.ends_at > now()
     )
$$;

REVOKE EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_build_bitmap(uuid, bigint, text) TO authenticated, service_role;