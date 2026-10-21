CREATE INDEX IF NOT EXISTS collection_trace_state_due_idx ON public.collection_trace_state(last_traced_at);
CREATE TABLE public.collection_backfill_lock (
  id text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT '1970-01-01'
);
GRANT ALL ON public.collection_backfill_lock TO service_role;
REVOKE ALL ON public.collection_backfill_lock FROM anon, authenticated;
ALTER TABLE public.collection_backfill_lock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny browser access" ON public.collection_backfill_lock FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);