-- bitmon_guardians: hide summoner account id
REVOKE SELECT ON public.bitmon_guardians FROM anon, authenticated;
GRANT SELECT (id, block_height, species, rarity, stats, dna_hash, summoned_by_address, payment_txid, created_at) ON public.bitmon_guardians TO anon, authenticated;

-- shadow_events: hide issuer account id
REVOKE SELECT ON public.shadow_events FROM anon, authenticated;
GRANT SELECT (id, slug, territory_block, title, subtitle, description, max_passes, passes_issued, is_active, starts_at, created_at, updated_at) ON public.shadow_events TO anon, authenticated;

-- block_facts_crawl_state: hide internal error text and locks
REVOKE SELECT ON public.block_facts_crawl_state FROM anon, authenticated;
GRANT SELECT (id, next_height, updated_at) ON public.block_facts_crawl_state TO anon, authenticated;

-- shord_pool_nullifiers: hide relay internals
REVOKE SELECT ON public.shord_pool_nullifiers FROM anon, authenticated;
GRANT SELECT (nullifier, root, out_commitment, created_at, relay_status, relay_txid) ON public.shord_pool_nullifiers TO anon, authenticated;