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
  IF _trait = 'same-digits' THEN RETURN char_length(_s) >= 3 AND translate(_s, left(_s, 1), '') = ''; END IF;
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