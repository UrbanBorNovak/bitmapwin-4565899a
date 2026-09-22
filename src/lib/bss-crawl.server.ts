/**
 * BSS scene discovery crawler.
 *
 * Walks indexed BITMAPs, asks the real chain whether each one carries a BSS
 * script inscription, decodes what it finds and records the outcome so the same
 * land is never re-scanned. Verified scenes are written to the public scene
 * directory by the decoder itself — nothing here invents a scene.
 */

import { bssSceneForBitmapInscription, bssSceneForHeight } from "@/lib/bss.server";

const MIN_INTERVAL_MS = 8_000;
const MAX_BATCH = 24;
const CONCURRENCY = 6;

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

/**
 * Picks indexed BITMAPs that have never been checked. Land people already care
 * about (placed models, raised structures, watched land, recorded claims) is
 * checked first, then the rest of the atlas is sampled from a rotating window so
 * discovery spreads across the map instead of crawling from block zero.
 */
async function candidates(batch: number, range?: { lo: number; hi: number }) {
  const db = await admin();
  const lo = range?.lo ?? 0;
  const hi = range?.hi ?? 10_000_000;

  const { data: scanned } = await db
    .from("bss_scan_state")
    .select("bitmap_height")
    .gte("bitmap_height", lo)
    .lte("bitmap_height", hi)
    .limit(20_000);
  const seen = new Set((scanned ?? []).map((row) => Number(row.bitmap_height)));

  const picked: number[] = [];
  const take = (value: unknown) => {
    const height = Number(value);
    if (!Number.isFinite(height) || height < lo || height > hi) return;
    if (seen.has(height) || picked.includes(height)) return;
    picked.push(height);
  };

  // Engaged land first: these BITMAPs are the likeliest to carry a script.
  const [models, structures, watches, claims] = await Promise.all([
    db.from("bitmap_models").select("bitmap_height").gte("bitmap_height", lo).lte("bitmap_height", hi).limit(200),
    db.from("world_structures").select("bitmap_height").gte("bitmap_height", lo).lte("bitmap_height", hi).limit(200),
    db.from("bitmap_watches").select("bitmap_height").gte("bitmap_height", lo).lte("bitmap_height", hi).limit(200),
    db
      .from("inscriptions")
      .select("bitmap_height")
      .eq("is_bitmap_claim", true)
      .gte("bitmap_height", lo)
      .lte("bitmap_height", hi)
      .limit(200),
  ]);
  for (const rows of [models.data, structures.data, watches.data, claims.data]) {
    for (const row of rows ?? []) {
      take((row as { bitmap_height: number | null }).bitmap_height);
      if (picked.length >= batch) return picked;
    }
  }

  // Then a rotating sample of the wider atlas.
  const { count } = await db
    .from("bitmap_index")
    .select("block_height", { count: "exact", head: true })
    .eq("is_valid", true)
    .gte("block_height", lo)
    .lte("block_height", hi);
  const total = count ?? 0;
  const window = Math.max(1, batch * 40);
  for (let attempt = 0; attempt < 6 && picked.length < batch; attempt++) {
    const offset = total > window ? Math.floor(Math.random() * (total - window)) : 0;
    const { data } = await db
      .from("bitmap_index")
      .select("block_height")
      .eq("is_valid", true)
      .gte("block_height", lo)
      .lte("block_height", hi)
      .order("block_height", { ascending: true })
      .range(offset, offset + window - 1);
    for (const row of data ?? []) {
      take(row.block_height);
      if (picked.length >= batch) break;
    }
  }
  return picked;
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
