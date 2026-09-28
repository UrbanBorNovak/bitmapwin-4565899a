CREATE TABLE public.block_props (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  target_height BIGINT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('parity','pool','fee')),
  pick TEXT NOT NULL,
  stake BIGINT NOT NULL CHECK (stake > 0),
  multiplier NUMERIC NOT NULL CHECK (multiplier > 1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  payout BIGINT NOT NULL DEFAULT 0,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX block_props_user_idx ON public.block_props (user_id, created_at DESC);
CREATE INDEX block_props_open_idx ON public.block_props (status, target_height);

GRANT SELECT ON public.block_props TO authenticated;
GRANT ALL ON public.block_props TO service_role;

ALTER TABLE public.block_props ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read their own block props"
ON public.block_props FOR SELECT TO authenticated
USING (user_id = auth.uid());