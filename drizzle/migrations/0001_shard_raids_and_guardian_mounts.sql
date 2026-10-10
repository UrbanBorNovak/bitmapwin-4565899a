CREATE TABLE public.shard_raid_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  raid_id bigint NOT NULL,
  shard_height bigint NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, raid_id, shard_height)
);
CREATE TABLE public.guardian_mount_unlocks (
  user_id uuid NOT NULL,
  block_height bigint NOT NULL,
  raid_id bigint NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, block_height)
);
REVOKE ALL ON public.shard_raid_claims FROM anon, authenticated;
REVOKE ALL ON public.guardian_mount_unlocks FROM anon, authenticated;
GRANT ALL ON public.shard_raid_claims TO service_role;
GRANT ALL ON public.guardian_mount_unlocks TO service_role;
ALTER TABLE public.shard_raid_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardian_mount_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no browser access" ON public.shard_raid_claims FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no browser access" ON public.guardian_mount_unlocks FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);