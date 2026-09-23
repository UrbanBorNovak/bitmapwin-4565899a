import { supabase } from "@/integrations/supabase/client";

/**
 * Real-data adapter. The game only asks questions here; it never knows the source.
 * Reads persistent Oasis builds (public world records). Returns null on failure so
 * callers show "BITMAP DATA UNAVAILABLE" instead of guessing.
 */
export async function fetchBuildCounts(heights: number[]): Promise<Map<number, number> | null> {
  const list = [...new Set(heights)].filter((h) => Number.isFinite(h) && h >= 0).slice(0, 60);
  if (!list.length) return new Map();
  try {
    const { data, error } = await supabase
      .from("world_structures")
      .select("bitmap_height")
      .in("bitmap_height", list)
      .limit(2000);
    if (error) return null;
    const counts = new Map<number, number>(list.map((h) => [h, 0]));
    for (const row of data ?? []) counts.set(row.bitmap_height, (counts.get(row.bitmap_height) ?? 0) + 1);
    return counts;
  } catch {
    return null;
  }
}
