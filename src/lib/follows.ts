import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Following builders. A builder is identified by the Bitcoin address that owns
 * the builds; follows are tied to the signed-in account (real auth user).
 */

export type FollowCount = { builderAddress: string; followers: number };

export async function fetchFollowerCounts(addresses: string[]): Promise<Map<string, number>> {
  if (addresses.length === 0) return new Map();
  const { data, error } = await supabase
    .from("builder_follows")
    .select("builder_address")
    .in("builder_address", addresses);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.builder_address, (counts.get(row.builder_address) ?? 0) + 1);
  }
  return counts;
}

export async function fetchMyFollows(): Promise<string[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from("builder_follows")
    .select("builder_address")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  return (data ?? []).map((row) => row.builder_address);
}

export async function followBuilder(address: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("SIGN IN TO FOLLOW BUILDERS");
  const { error } = await supabase
    .from("builder_follows")
    .insert({ user_id: auth.user.id, builder_address: address });
  if (error && error.code !== "23505") throw error;
}

export async function unfollowBuilder(address: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("builder_follows")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("builder_address", address);
  if (error) throw error;
}

export const followerCountsQuery = (addresses: string[]) =>
  queryOptions({
    queryKey: ["builder-follower-counts", [...addresses].sort()],
    queryFn: () => fetchFollowerCounts(addresses),
    staleTime: 30_000,
  });

export const myFollowsQuery = () =>
  queryOptions({
    queryKey: ["my-builder-follows"],
    queryFn: fetchMyFollows,
    staleTime: 15_000,
  });
