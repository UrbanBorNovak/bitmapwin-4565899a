import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the real satoshi number a bitmap is inscribed on from the on-chain
 * index. Lookups made in the same tick are batched into one request so a full
 * grid of cards costs a single round trip.
 */

let pending: number[] = [];
let inflight: Promise<Map<number, number>> | null = null;

async function flush(): Promise<Map<number, number>> {
  const heights = [...new Set(pending)].slice(0, 400);
  pending = [];
  inflight = null;
  const map = new Map<number, number>();
  if (heights.length === 0) return map;
  const { data, error } = await supabase
    .from("bitmap_index")
    .select("block_height, sat")
    .in("block_height", heights);
  if (error) return map;
  for (const row of data ?? []) {
    if (row.sat !== null && row.sat !== undefined) map.set(row.block_height, Number(row.sat));
  }
  return map;
}

export function loadSat(height: number): Promise<number | null> {
  pending.push(height);
  if (!inflight) {
    inflight = new Promise<Map<number, number>>((resolve) => {
      setTimeout(() => resolve(flush()), 30);
    });
  }
  return inflight.then((map) => map.get(height) ?? null);
}

export const satQuery = (height: number) =>
  queryOptions({
    queryKey: ["bitmap", "sat", height],
    queryFn: () => loadSat(height),
    staleTime: Infinity,
  });
