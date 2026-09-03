import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Ownership colours for the land map. Only the districts inside the visible
 * window are read (through the map_owners helper), because the registry holds
 * hundreds of thousands of owned heights — far too many to ship to the client.
 */
export type OwnerWindow = {
  rowFrom: number;
  rowTo: number;
  colFrom: number;
  colTo: number;
};

export async function fetchOwnersInWindow(win: OwnerWindow): Promise<Map<number, string>> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, number>,
  ) => Promise<{ data: { block_height: number; owner_address: string }[] | null; error: unknown }>)(
    "map_owners",
    {
      _row_from: win.rowFrom,
      _row_to: win.rowTo,
      _col_from: win.colFrom,
      _col_to: win.colTo,
    },
  );
  if (error) throw error;
  const map = new Map<number, string>();
  for (const row of data ?? []) map.set(Number(row.block_height), row.owner_address);
  return map;
}

export const mapOwnersQuery = (win: OwnerWindow | null) =>
  queryOptions({
    queryKey: ["map-owners", win?.rowFrom, win?.rowTo, win?.colFrom, win?.colTo],
    queryFn: () => fetchOwnersInWindow(win!),
    enabled: !!win,
    staleTime: 60_000,
  });

/**
 * Deterministic colour per address: the same holder always gets the same hue,
 * everywhere on the map, without keeping a palette table anywhere.
 */
export function colorForAddress(address: string): string {
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = Math.abs(h) % 360;
  const sat = 62 + (Math.abs(h >> 9) % 26);
  const light = 52 + (Math.abs(h >> 17) % 18);
  return `hsl(${hue} ${sat}% ${light}%)`;
}
