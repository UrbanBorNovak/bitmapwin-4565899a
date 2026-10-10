/**
 * Active builders, ranked from public community pieces (forge_modules).
 * Avatars are deterministic from the maker's address — no browser claims.
 */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ActiveBuilder = {
  address: string;
  pieces: number;
  uses: number;
  blocks: number;
  latest: { id: string; name: string; sphere: string; blocks: number; at: string };
  lastAt: string;
  score: number;
};

const DAY = 86_400_000;

export function rankBuilders(
  rows: { id: string; name: string; sphere: string; author_address: string; block_count: number; uses: number; created_at: string }[],
  now = Date.now(),
): ActiveBuilder[] {
  const by = new Map<string, ActiveBuilder>();
  for (const r of rows) {
    if (!r.author_address) continue;
    const b = by.get(r.author_address) ?? {
      address: r.author_address, pieces: 0, uses: 0, blocks: 0,
      latest: { id: r.id, name: r.name, sphere: r.sphere, blocks: r.block_count, at: r.created_at },
      lastAt: r.created_at, score: 0,
    };
    b.pieces += 1;
    b.uses += r.uses;
    b.blocks += r.block_count;
    if (r.created_at > b.lastAt) {
      b.lastAt = r.created_at;
      b.latest = { id: r.id, name: r.name, sphere: r.sphere, blocks: r.block_count, at: r.created_at };
    }
    by.set(r.author_address, b);
  }
  for (const b of by.values()) {
    const ageDays = Math.max(0, (now - Date.parse(b.lastAt)) / DAY);
    // Recency dominates so newly active makers rise; reuse keeps veterans visible.
    b.score = b.pieces * 10 + b.uses * 3 + 100 / (1 + ageDays);
  }
  return [...by.values()].sort((a, b) => b.score - a.score);
}

export async function fetchActiveBuilders(limit = 12): Promise<ActiveBuilder[]> {
  const { data } = await supabase
    .from("forge_modules")
    .select("id, name, sphere, author_address, block_count, uses, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  return rankBuilders(data ?? []).slice(0, limit);
}

export const activeBuildersQuery = queryOptions({
  queryKey: ["forge", "active-builders"],
  queryFn: () => fetchActiveBuilders(12),
  staleTime: 60_000,
});

export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

/** 5×5 mirrored voxel identicon cells + hue derived from the address. */
export function builderAvatar(address: string): { hue: number; cells: boolean[] } {
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) h = Math.imul(h ^ address.charCodeAt(i), 16777619);
  const cells: boolean[] = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const m = x < 3 ? x : 4 - x;
    cells.push(((h >>> (y * 3 + m)) & 1) === 1);
  }
  return { hue: Math.abs(h) % 360, cells };
}
