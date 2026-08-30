import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActivityEvent, Bitmap } from "@/lib/bitmap";

/**
 * Data access layer. Today it reads the seeded registry in Lovable Cloud.
 * A real Ordinals / Bitmap indexer can be swapped in behind these functions
 * without touching any UI component.
 */

export async function fetchBitmaps(limit = 200): Promise<Bitmap[]> {
  const { data, error } = await supabase
    .from("bitmaps")
    .select("*")
    .order("block_height", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    price_btc: row.price_btc === null ? null : Number(row.price_btc),
  })) as Bitmap[];
}

export async function fetchBitmapByBlock(block: number): Promise<Bitmap | null> {
  const { data, error } = await supabase
    .from("bitmaps")
    .select("*")
    .eq("block_height", block)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    price_btc: data.price_btc === null ? null : Number(data.price_btc),
  } as Bitmap;
}

export async function fetchActivity(limit = 40): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("activity")
    .select("*, bitmaps(block_height)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const rel = row as unknown as { bitmaps?: { block_height: number } | null };
    return {
      ...(row as unknown as ActivityEvent),
      block_height: rel.bitmaps?.block_height ?? null,
    };
  });
}

export const bitmapsQuery = (limit = 200) =>
  queryOptions({ queryKey: ["bitmaps", limit], queryFn: () => fetchBitmaps(limit) });

export const bitmapQuery = (block: number) =>
  queryOptions({ queryKey: ["bitmap", block], queryFn: () => fetchBitmapByBlock(block) });

export const activityQuery = (limit = 40) =>
  queryOptions({ queryKey: ["activity", limit], queryFn: () => fetchActivity(limit) });
