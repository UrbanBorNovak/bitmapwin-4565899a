DROP POLICY IF EXISTS "Kennels are public" ON public.bitmap_kennels;
CREATE POLICY "Open kennels are public" ON public.bitmap_kennels FOR SELECT TO anon, authenticated USING (is_open = true);
REVOKE SELECT ON public.bitmap_kennels FROM anon, authenticated;
GRANT SELECT (block_height, name, price_sats, max_supply, minted_count, payout_address, is_open, created_at, updated_at) ON public.bitmap_kennels TO anon, authenticated;
DROP POLICY IF EXISTS "Kennel mints are public" ON public.kennel_mints;
CREATE POLICY "Mints of existing kennels are public" ON public.kennel_mints FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.bitmap_kennels k WHERE k.block_height = kennel_mints.block_height));
REVOKE SELECT ON public.kennel_mints FROM anon, authenticated;
GRANT SELECT (id, block_height, child_index, inscription_id, reveal_txid, created_at) ON public.kennel_mints TO anon, authenticated;