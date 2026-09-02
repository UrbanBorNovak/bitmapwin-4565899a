import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapWithConcurrency, persist, resolveOne } from "@/lib/oci.server";

/**
 * Registry resolver pass.
 *
 * The bitmap registry holds every block claim (0 … 906,999) with its
 * ordinal sat, but only part of them carry a resolved inscription id. The
 * crawler can only trace sales for rows that have one, so this pass walks the
 * unresolved rows — oldest attempt first — reads the real inscription from the
 * ordinals index and writes it back. Nothing is synthesised: a row stays
 * unresolved when the index has no inscription on that sat yet.
 */

const MAX_BATCH = 60;
const CONCURRENCY = 8;
/** Traffic-driven pass: at most one run per window, app-wide. */
const THROTTLE_MS = 10_000;

const db = () => supabaseAdmin;

export type ResolveResult = {
  attempted: number;
  resolved: number;
  heights: number[];
};

export async function resolveRegistryBatch(batch = 25): Promise<ResolveResult> {
  const size = Math.max(1, Math.min(batch, MAX_BATCH));
  const client = db();

  const { data, error } = await client
    .from("bitmap_index")
    .select("block_height")
    .is("inscription_id", null)
    // Oldest attempt first, so a stubborn row never blocks the queue.
    .order("resolved_at", { ascending: true })
    .order("block_height", { ascending: false })
    .limit(size);
  if (error) throw Object.assign(error, { stage: "unresolved-read" });

  const heights = (data ?? []).map((row) => Number(row.block_height));
  if (heights.length === 0) return { attempted: 0, resolved: 0, heights: [] };

  const entries = await mapWithConcurrency(heights, CONCURRENCY, resolveOne);
  await persist(entries);

  const resolvedHeights = entries.filter((e) => e.inscriptionId).map((e) => e.blockHeight);
  return { attempted: heights.length, resolved: resolvedHeights.length, heights: resolvedHeights };
}

export async function resolveRegistryThrottled(
  batch = 25,
): Promise<ResolveResult & { skipped: boolean }> {
  const client = db();
  const { data } = await client
    .from("bitmap_index")
    .select("resolved_at")
    .order("resolved_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.resolved_at ? Date.parse(data[0]!.resolved_at) : 0;
  if (Date.now() - last < THROTTLE_MS) {
    return { attempted: 0, resolved: 0, heights: [], skipped: true };
  }
  return { ...(await resolveRegistryBatch(batch)), skipped: false };
}

export type ResolveProgress = {
  total: number;
  resolved: number;
  unresolved: number;
  lastResolvedAt: string | null;
};

export async function resolveProgress(): Promise<ResolveProgress> {
  const client = db();
  const [{ count: total }, { count: resolved }, { data: last }] = await Promise.all([
    client.from("bitmap_index").select("*", { count: "exact", head: true }),
    client
      .from("bitmap_index")
      .select("*", { count: "exact", head: true })
      .not("inscription_id", "is", null),
    client
      .from("bitmap_index")
      .select("resolved_at")
      .not("inscription_id", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(1),
  ]);
  return {
    total: total ?? 0,
    resolved: resolved ?? 0,
    unresolved: Math.max(0, (total ?? 0) - (resolved ?? 0)),
    lastResolvedAt: last?.[0]?.resolved_at ?? null,
  };
}
