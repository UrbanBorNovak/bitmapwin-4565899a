/**
 * BSS scene discovery crawler.
 *
 * Walks indexed BITMAPs, asks the real chain whether each one carries a BSS
 * script inscription, decodes what it finds and records the outcome so the same
 * land is never re-scanned. Verified scenes are written to the public scene
 * directory by the decoder itself — nothing here invents a scene.
 */

import { bssSceneForHeight } from "@/lib/bss.server";

const MIN_INTERVAL_MS = 8_000;
const MAX_BATCH = 8;

type Outcome = "scene" | "invalid" | "none" | "error";

export type BssCrawlResult = {
  skipped: boolean;
  scanned: number;
  scenesFound: number;
  heights: number[];
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Indexed BITMAPs that have never been checked for a scene. */
async function candidates(batch: number, range?: { lo: number; hi: number }) {
  const db = await admin();
  const { data: scanned } = await db
    .from("bss_scan_state")
    .select("bitmap_height")
    .gte("bitmap_height", range?.lo ?? 0)
    .lte("bitmap_height", range?.hi ?? 10_000_000)
    .limit(5_000);
  const seen = new Set((scanned ?? []).map((row) => Number(row.bitmap_height)));

  let query = db
    .from("bitmap_index")
    .select("block_height")
    .eq("is_valid", true)
    .order("block_height", { ascending: true })
    .limit(batch + seen.size + 50);
  if (range) query = query.gte("block_height", range.lo).lte("block_height", range.hi);

  const { data } = await query;
  const heights: number[] = [];
  for (const row of data ?? []) {
    const height = Number(row.block_height);
    if (!Number.isFinite(height) || seen.has(height)) continue;
    heights.push(height);
    if (heights.length >= batch) break;
  }
  return heights;
}

async function recentlyRan() {
  const db = await admin();
  const { data } = await db
    .from("bss_scan_state")
    .select("scanned_at")
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.scanned_at) return false;
  return Date.now() - new Date(data.scanned_at).getTime() < MIN_INTERVAL_MS;
}

/** Scans one small batch of BITMAPs for real BSS scripts. */
export async function crawlBssScenes(
  batch = 4,
  range?: { lo: number; hi: number },
  throttle = true,
): Promise<BssCrawlResult> {
  const size = Math.max(1, Math.min(MAX_BATCH, Math.floor(batch)));
  if (throttle && (await recentlyRan())) {
    return { skipped: true, scanned: 0, scenesFound: 0, heights: [] };
  }

  const heights = await candidates(size, range);
  if (heights.length === 0) return { skipped: false, scanned: 0, scenesFound: 0, heights: [] };

  const db = await admin();
  let scenesFound = 0;
  const rows: Array<{ bitmap_height: number; outcome: Outcome; detail: string | null; scanned_at: string }> = [];

  for (const height of heights) {
    let outcome: Outcome = "none";
    let detail: string | null = null;
    try {
      const load = await bssSceneForHeight(height);
      if (load.status === "ok") {
        if (load.scene.ok) {
          outcome = "scene";
          scenesFound += 1;
          detail = `BSS ${load.scene.versionLabel} · ${load.scene.objects.length} objects`;
        } else {
          outcome = "invalid";
          detail = load.scene.diagnostics[0] ?? "Scene failed validation";
        }
      } else if (load.status === "error") {
        outcome = "error";
        detail = load.reason;
      } else {
        detail = load.reason;
      }
    } catch (error) {
      outcome = "error";
      detail = error instanceof Error ? error.message : "Scan failed";
    }
    rows.push({
      bitmap_height: height,
      outcome,
      detail: detail ? detail.slice(0, 300) : null,
      scanned_at: new Date().toISOString(),
    });
  }

  await db.from("bss_scan_state").upsert(rows, { onConflict: "bitmap_height" });
  return { skipped: false, scanned: rows.length, scenesFound, heights };
}

/** How far scene discovery has walked, for display. */
export async function bssCrawlProgress(range?: { lo: number; hi: number }) {
  const db = await admin();
  let scanned = db.from("bss_scan_state").select("bitmap_height", { count: "exact", head: true });
  let scenes = db
    .from("bitmap_bss_scenes")
    .select("bitmap_height", { count: "exact", head: true })
    .eq("is_valid", true);
  if (range) {
    scanned = scanned.gte("bitmap_height", range.lo).lte("bitmap_height", range.hi);
    scenes = scenes.gte("bitmap_height", range.lo).lte("bitmap_height", range.hi);
  }
  const [{ count: scannedCount }, { count: sceneCount }] = await Promise.all([scanned, scenes]);
  return { scanned: scannedCount ?? 0, scenes: sceneCount ?? 0 };
}
