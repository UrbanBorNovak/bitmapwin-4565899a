CREATE OR REPLACE FUNCTION public.bitmap_has_height_trait(_height bigint, _trait text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _s text := _height::text;
  _n bigint;
  _a bigint := 0;
  _b bigint := 1;
BEGIN
  IF _height < 0 THEN RETURN false; END IF;
  IF _trait = 'mythic' THEN RETURN _height = 0; END IF;
  IF _trait = 'epic' THEN RETURN _height IN (210000, 420000, 630000, 840000, 1050000); END IF;
  IF _trait = 'rare' THEN RETURN _height > 0 AND _height % 2016 = 0; END IF;
  IF _trait = 'first-transaction' THEN RETURN _height = 170; END IF;
  IF _trait = 'palindrome' THEN RETURN char_length(_s) >= 3 AND _s = reverse(_s); END IF;
  IF _trait = 'pizza-transaction' THEN RETURN _height = 57043; END IF;
  IF _trait = 'pizza-day' THEN RETURN _height BETWEEN 56899 AND 57093; END IF;
  IF _trait = 'same-digits' THEN RETURN char_length(_s) >= 3 AND _s !~ '(.)(?!\1)'; END IF;
  IF _trait = 'block-9' THEN RETURN _height = 9; END IF;
  IF _trait = 'block-78' THEN RETURN _height = 78; END IF;
  IF _trait = '66-dao' THEN RETURN _height BETWEEN 660000 AND 669999; END IF;
  IF _trait = 'prime-number' THEN
    IF _height < 2 THEN RETURN false; END IF;
    IF _height = 2 THEN RETURN true; END IF;
    IF _height % 2 = 0 THEN RETURN false; END IF;
    _n := 3;
    WHILE _n * _n <= _height LOOP
      IF _height % _n = 0 THEN RETURN false; END IF;
      _n := _n + 2;
    END LOOP;
    RETURN true;
  END IF;
  IF _trait = 'fibonacci' THEN
    IF _height < 1 THEN RETURN false; END IF;
    WHILE _b < _height LOOP
      _n := _a + _b; _a := _b; _b := _n;
    END LOOP;
    RETURN _b = _height;
  END IF;
  IF _trait = 'binary' THEN RETURN _s ~ '^[01]+$'; END IF;
  IF _trait = 'power-of-10' THEN RETURN _height IN (1,10,100,1000,10000,100000,1000000); END IF;
  IF _trait = 'sub-10' THEN RETURN _height < 10; END IF;
  IF _trait = 'sub-100' THEN RETURN _height < 100; END IF;
  IF _trait = 'sub-1k' THEN RETURN _height < 1000; END IF;
  IF _trait = 'sub-10k' THEN RETURN _height < 10000; END IF;
  IF _trait = 'sub-25k' THEN RETURN _height < 25000; END IF;
  IF _trait = 'sub-50k' THEN RETURN _height < 50000; END IF;
  IF _trait = 'sub-100k' THEN RETURN _height < 100000; END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.bitmap_has_height_trait(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bitmap_has_height_trait(bigint, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_bitmap_archaeology_nomination()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _supported text[] := ARRAY['mythic','epic','rare','first-transaction','palindrome','pizza-transaction','pizza-day','same-digits','block-9','block-78','66-dao','prime-number','fibonacci','binary','power-of-10','sub-10','sub-100','sub-1k','sub-10k','sub-25k','sub-50k','sub-100k'];
  _official text[] := ARRAY['mythic','epic','rare','first-transaction','palindrome','pizza-transaction','pizza-day','same-digits','block-9','block-78','66-dao','prime-number','fibonacci','binary','power-of-10','sub-10','sub-100','sub-1k','sub-10k','sub-25k','sub-50k','sub-100k','patoshi','billionaire','mined-billionaire','5tx-perfect-punk','7tx-perfect-punk','10tx-perfect-punk','13tx-perfect-punk','17tx-perfect-punk','21tx-perfect-punk','26tx-perfect-punk','43tx-perfect-punk','pristine-punk','standard-punk','wide-neck-punk','grid-punk','community-punk','ross-ulbricht','mondrian','leap-day','notable-event','1-tx','2-tx','miner-message','xspectar','bitmap-valley','100000-out','250000-out','500000-out','1000000-out','3000000-out','5000000-out','micro-strategy','chinese-lucky-number','pre-segwit-full','dual-palindrome','1k-txs','2k-txs','3k-txs','4k-txs','5k-txs','6k-txs','7k-txs','8k-txs','1k-fee-rate','2k-fee-rate','3k-fee-rate','4k-fee-rate','5k-fee-rate','6k-fee-rate','7k-fee-rate','21e8'];
BEGIN
  IF NOT (NEW.trait_id = ANY(_official)) THEN
    RAISE EXCEPTION 'Unknown official trait';
  END IF;
  IF NEW.trait_id = ANY(_supported) AND NOT public.bitmap_has_height_trait(NEW.bitmap_height, NEW.trait_id) THEN
    RAISE EXCEPTION 'BITMAP height does not match this official trait';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_bitmap_archaeology_nomination_before_write
BEFORE INSERT OR UPDATE ON public.bitmap_archaeology_nominations
FOR EACH ROW EXECUTE FUNCTION public.validate_bitmap_archaeology_nomination();

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
    WHERE bi.block_height = bitmap_height
      AND bi.inscription_id = inscription_id
      AND bi.is_valid = true
  )
);