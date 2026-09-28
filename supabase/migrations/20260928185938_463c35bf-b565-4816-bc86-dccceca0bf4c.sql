ALTER TABLE public.shadow_events ADD COLUMN IF NOT EXISTS issuer_user_id uuid;
CREATE INDEX IF NOT EXISTS shadow_events_issuer_idx ON public.shadow_events (issuer_user_id);
CREATE INDEX IF NOT EXISTS shadow_events_block_idx ON public.shadow_events (territory_block);