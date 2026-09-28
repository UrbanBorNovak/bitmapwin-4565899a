CREATE TABLE public.shadow_l1_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  op text NOT NULL CHECK (op IN ('gate','pass','spend')),
  slug text NOT NULL,
  territory_block bigint NOT NULL,
  pass_index integer NOT NULL DEFAULT 0,
  digest_hex text NOT NULL CHECK (digest_hex ~ '^[0-9a-f]{64}$'),
  payload_hex text NOT NULL CHECK (payload_hex ~ '^[0-9a-f]{86}$'),
  txid text NOT NULL UNIQUE CHECK (txid ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'broadcast' CHECK (status IN ('broadcast','confirmed')),
  confirmed_height bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shadow_l1_notes_slug_idx ON public.shadow_l1_notes (slug);
CREATE INDEX shadow_l1_notes_digest_idx ON public.shadow_l1_notes (digest_hex);
CREATE UNIQUE INDEX shadow_l1_notes_gate_once_idx ON public.shadow_l1_notes (slug) WHERE op = 'gate';

GRANT SELECT ON public.shadow_l1_notes TO anon;
GRANT SELECT ON public.shadow_l1_notes TO authenticated;
GRANT ALL ON public.shadow_l1_notes TO service_role;

ALTER TABLE public.shadow_l1_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shadow L1 notes are public chain records"
  ON public.shadow_l1_notes FOR SELECT USING (true);

CREATE TRIGGER update_shadow_l1_notes_updated_at
  BEFORE UPDATE ON public.shadow_l1_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();