ALTER TABLE public.guardian_dispatches ADD COLUMN repeat boolean NOT NULL DEFAULT false, ADD COLUMN chained boolean NOT NULL DEFAULT false;
CREATE INDEX guardian_dispatches_repeat ON public.guardian_dispatches (ends_at) WHERE repeat AND NOT chained AND recalled_at IS NULL;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;