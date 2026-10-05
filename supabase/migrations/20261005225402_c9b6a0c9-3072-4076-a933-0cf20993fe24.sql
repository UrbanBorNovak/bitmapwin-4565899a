ALTER TABLE public.guardian_raids ADD COLUMN lap integer NOT NULL DEFAULT 0;
ALTER TABLE public.guardian_raids DROP CONSTRAINT guardian_raids_dispatch_id_key;
ALTER TABLE public.guardian_raids ADD CONSTRAINT guardian_raids_dispatch_lap_key UNIQUE (dispatch_id, lap);
DROP INDEX IF EXISTS public.guardian_dispatches_repeat;
ALTER TABLE public.guardian_dispatches DROP COLUMN chained;