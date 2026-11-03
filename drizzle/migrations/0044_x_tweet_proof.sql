ALTER TABLE public.wallet_profiles
  ADD COLUMN IF NOT EXISTS x_verified_tweet_id text,
  ADD COLUMN IF NOT EXISTS x_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_x_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user <> 'service_role' AND current_user <> 'postgres' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.x_verified_tweet_id := NULL; NEW.x_verified_at := NULL;
    ELSE
      NEW.x_verified_tweet_id := OLD.x_verified_tweet_id; NEW.x_verified_at := OLD.x_verified_at;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.x_handle IS DISTINCT FROM OLD.x_handle THEN
    NEW.x_verified_tweet_id := NULL; NEW.x_verified_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_x_verification ON public.wallet_profiles;
CREATE TRIGGER guard_x_verification BEFORE INSERT OR UPDATE ON public.wallet_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_x_verification();