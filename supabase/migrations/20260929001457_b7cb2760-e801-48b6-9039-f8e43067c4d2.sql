CREATE TABLE public.shord_mint_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commit_address TEXT NOT NULL UNIQUE,
  commitment TEXT NOT NULL,
  block_height INTEGER,
  inscription_id TEXT,
  reveal_txid TEXT,
  status TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.shord_mint_claims TO service_role;

ALTER TABLE public.shord_mint_claims ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_shord_mint_claims_updated_at
BEFORE UPDATE ON public.shord_mint_claims
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();