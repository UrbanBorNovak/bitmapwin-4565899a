DROP POLICY IF EXISTS "shadow_events public read" ON public.shadow_events;
CREATE POLICY "shadow_events public read"
ON public.shadow_events
FOR SELECT
TO anon, authenticated
USING (is_active = true);

DROP POLICY IF EXISTS "Crawl progress is public" ON public.block_facts_crawl_state;
CREATE POLICY "Crawl progress is public"
ON public.block_facts_crawl_state
FOR SELECT
TO anon, authenticated
USING (id = 'main' AND next_height >= 0);

DROP POLICY IF EXISTS "Guardians are public" ON public.bitmon_guardians;
CREATE POLICY "Guardians are public"
ON public.bitmon_guardians
FOR SELECT
TO anon, authenticated
USING (payment_txid IS NOT NULL AND block_height >= 0);