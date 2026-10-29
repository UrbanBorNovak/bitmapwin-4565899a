ALTER TABLE public.puzzle_pool_slices ADD COLUMN block_height integer;
CREATE INDEX puzzle_pool_slices_block_idx ON public.puzzle_pool_slices (block_height) WHERE block_height IS NOT NULL;