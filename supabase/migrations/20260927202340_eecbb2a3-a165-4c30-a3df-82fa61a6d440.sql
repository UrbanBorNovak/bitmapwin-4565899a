REVOKE SELECT ON public.bitmap_archaeology_nominations FROM anon, authenticated;
REVOKE INSERT ON public.bitmap_archaeology_nominations FROM authenticated;

GRANT SELECT (
  id, trait_id, bitmap_height, inscription_id, thesis, evidence_url,
  contributor_name, status, review_note, featured_position,
  created_at, updated_at, reviewed_at
) ON public.bitmap_archaeology_nominations TO anon, authenticated;

GRANT INSERT (
  user_id, trait_id, bitmap_height, inscription_id, thesis,
  evidence_url, contributor_name, status
) ON public.bitmap_archaeology_nominations TO authenticated;