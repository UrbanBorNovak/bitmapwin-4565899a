DROP POLICY "Contributors nominate archaeology" ON public.bitmap_archaeology_nominations;
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
    SELECT 1 FROM public.bitmap_index bi
    WHERE bi.block_height = bitmap_archaeology_nominations.bitmap_height
      AND bi.inscription_id = bitmap_archaeology_nominations.inscription_id
      AND bi.is_valid = true
  )
);