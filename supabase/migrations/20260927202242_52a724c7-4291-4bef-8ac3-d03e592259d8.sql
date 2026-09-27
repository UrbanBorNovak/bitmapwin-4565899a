CREATE TABLE public.bitmap_archaeology_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trait_id text NOT NULL,
  bitmap_height bigint NOT NULL CHECK (bitmap_height >= 0),
  inscription_id text NOT NULL,
  thesis text NOT NULL,
  evidence_url text NOT NULL,
  contributor_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  featured_position smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT bitmap_archaeology_status_valid CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT bitmap_archaeology_feature_position_valid CHECK (featured_position IS NULL OR featured_position BETWEEN 1 AND 3),
  CONSTRAINT bitmap_archaeology_thesis_length CHECK (char_length(thesis) BETWEEN 30 AND 1200),
  CONSTRAINT bitmap_archaeology_contributor_length CHECK (char_length(contributor_name) BETWEEN 2 AND 40),
  CONSTRAINT bitmap_archaeology_evidence_url CHECK (evidence_url ~ '^https://'),
  CONSTRAINT bitmap_archaeology_unique_nomination UNIQUE (user_id, trait_id, bitmap_height),
  CONSTRAINT bitmap_archaeology_unique_feature UNIQUE (trait_id, featured_position)
);

GRANT SELECT, INSERT ON public.bitmap_archaeology_nominations TO authenticated;
GRANT SELECT ON public.bitmap_archaeology_nominations TO anon;
GRANT ALL ON public.bitmap_archaeology_nominations TO service_role;

ALTER TABLE public.bitmap_archaeology_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accepted archaeology is public"
ON public.bitmap_archaeology_nominations
FOR SELECT
TO anon, authenticated
USING (status = 'accepted');

CREATE POLICY "Contributors read own archaeology"
ON public.bitmap_archaeology_nominations
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Contributors nominate archaeology"
ON public.bitmap_archaeology_nominations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND review_note IS NULL
  AND reviewed_at IS NULL
  AND featured_position IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.bitmap_index bi
    WHERE bi.block_height = bitmap_height
      AND bi.inscription_id = inscription_id
      AND bi.is_valid = true
  )
  AND (
    trait_id NOT IN (
      'mythic','epic','rare','first-transaction','palindrome','pizza-transaction','pizza-day','same-digits','block-9','block-78','66-dao','prime-number','fibonacci','binary','power-of-10','sub-10','sub-100','sub-1k','sub-10k','sub-25k','sub-50k','sub-100k'
    )
    OR EXISTS (
      SELECT 1
      FROM public.official_trait_bitmaps(trait_id, 0, 121) otb
      WHERE otb.block_height = bitmap_height
        AND otb.inscription_id = inscription_id
    )
  )
);

CREATE INDEX bitmap_archaeology_public_idx
ON public.bitmap_archaeology_nominations (trait_id, featured_position, reviewed_at DESC)
WHERE status = 'accepted';

CREATE INDEX bitmap_archaeology_owner_idx
ON public.bitmap_archaeology_nominations (user_id, created_at DESC);

CREATE TRIGGER update_bitmap_archaeology_updated_at
BEFORE UPDATE ON public.bitmap_archaeology_nominations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();