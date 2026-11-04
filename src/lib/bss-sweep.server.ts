/**
 * Chain-side BSS discovery.
 *
 * Instead of guessing which BITMAP might carry a scene, this sweeps real Bitcoin
 * blocks, looks at every BMP inscription in them, decodes it, and — when the file
 * really is a BSS script whose parent is the BITMAP it declares — registers the
 * scene in the public directory. Every block is remembered once swept.
 */

import { bssDecode } from "@/lib/bss/format";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MAX_PAGES = 20;
const MAX_BMP_BYTES = 2_000_000;

export type BssSweepResult = {
  skipped: boolean;
  blocks: number[];
  inscriptions: number;
  bmpSeen: number;
  scenesFound: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function text(path: string) {
  try {
    const resp = await fetch(`${ORD}${path}`, { headers: { "user-agent": UA } });
    return resp.ok ? await resp.text() : null;
  } catch {
    return null;
  }
}

async function json<T>(path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${ORD}${path}`, {
      headers: { "user-agent": UA, accept: "application/json" },
    });
    return resp.ok ? ((await resp.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Inscription ids created in one Bitcoin block. */
async function inscriptionsInBlock(height: number): Promise<string[]> {
  const ids = new Set<string>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const body = await text(`/inscriptions/block/${height}/${page}`);
    if (!body) break;
    const matches = body.match(/\/inscription\/[0-9a-f]{64}i\d+/g) ?? [];
    const before = ids.size;
    for (const match of matches) ids.add(match.replace("/inscription/", ""));
    if (ids.size === before) break;
  }
  return [...ids];
}

/** Chain tip, so sweeping starts from real blocks. */
async function chainTip(): Promise<number | null> {
  const body = await text("/r/blockheight");
  const height = Number((body ?? "").trim());
  return Number.isFinite(height) && height > 0 ? height : null;
}

/** Blocks that have not been swept yet, newest first. */
async function nextBlocks(count: number): Promise<number[]> {
  const tip = await chainTip();
  if (!tip) return [];
  const db = await admin();
  const { data } = await db
    .from("bss_block_scan")
    .select("block_height")
    .order("block_height", { ascending: false })
    .limit(20_000);
  const swept = new Set((data ?? []).map((row) => Number(row.block_height)));
  const out: number[] = [];
  for (let height = tip; height > tip - 20_000 && out.length < count; height--) {
    if (!swept.has(height)) out.push(height);
  }
  return out;
}

async function registerScene(height: number, inscriptionId: string, scene: ReturnType<typeof bssDecode>) {
  if ("error" in scene || !scene.ok) return false;
  const db = await admin();
  await db.from("bitmap_bss_scenes").upsert(
    {
      bitmap_height: height,
      bmp_inscription_id: inscriptionId,
      version_label: scene.versionLabel,
      object_count: scene.objects.length,
      resource_count: scene.resources.length,
      is_valid: true,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "bitmap_height" },
  );
  await db.from("bss_scan_state").upsert(
    {
      bitmap_height: height,
      outcome: "scene",
      detail: `BSS ${scene.versionLabel} · ${scene.objects.length} objects`,
      scanned_at: new Date().toISOString(),
    },
    { onConflict: "bitmap_height" },
  );
  return true;
}

/**
 * Resolves the BITMAP a script belongs to: the script's parent inscription must
 * be the BITMAP inscription indexed for the block the script declares.
 */
async function bitmapForScript(inscriptionId: string, declared: number | null): Promise<number | null> {
  if (declared === null || declared < 0) return null;
  const parents = await json<{ ids?: string[] }>(`/r/parents/${inscriptionId}`);
  const parentId = parents?.ids?.[0];
  if (!parentId) return null;
  const db = await admin();
  const { data } = await db
    .from("bitmap_index")
    .select("block_height")
    .eq("inscription_id", parentId)
    .maybeSingle();
  if (data?.block_height !== undefined && Number(data.block_height) === declared) return declared;
  // Not indexed locally: confirm the parent is that block's bitmap on chain.
  const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
  try {
    const holder = await locateBitmapHolder(declared);
    return holder.inscriptionId === parentId ? declared : null;
  } catch {
    return null;
  }
}

/** Sweeps a few unswept Bitcoin blocks for real BSS scripts. */
export async function sweepBssBlocks(blocks = 2): Promise<BssSweepResult> {
  const heights = await nextBlocks(Math.max(1, Math.min(6, Math.floor(blocks))));
  if (heights.length === 0)
    return { skipped: true, blocks: [], inscriptions: 0, bmpSeen: 0, scenesFound: 0 };

  const db = await admin();
  let inscriptions = 0;
  let bmpSeen = 0;
  let scenesFound = 0;
  const rows: Array<{
    block_height: number;
    inscriptions_seen: number;
    bmp_seen: number;
    scenes_found: number;
    scanned_at: string;
  }> = [];

  for (const height of heights) {
    const ids = await inscriptionsInBlock(height);
    inscriptions += ids.length;
    let blockBmp = 0;
    let blockScenes = 0;

    for (const id of ids) {
      const meta = await json<{ content_type?: string; content_length?: number }>(`/r/inscription/${id}`);
      const type = (meta?.content_type ?? "").toLowerCase();
      if (!type.includes("bmp")) continue;
      if ((meta?.content_length ?? 0) > MAX_BMP_BYTES) continue;
      blockBmp += 1;

      let bytes: Uint8Array;
      try {
        const resp = await fetch(`${ORD}/content/${id}`, { headers: { "user-agent": UA } });
        if (!resp.ok) continue;
        bytes = new Uint8Array(await resp.arrayBuffer());
      } catch {
        continue;
      }
      const decoded = bssDecode(bytes, id);
      if ("error" in decoded || !decoded.ok) continue;
      const bitmapHeight = await bitmapForScript(id, decoded.blockTarget);
      if (bitmapHeight === null) continue;
      if (await registerScene(bitmapHeight, id, decoded)) blockScenes += 1;
    }

    bmpSeen += blockBmp;
    scenesFound += blockScenes;
    rows.push({
      block_height: height,
      inscriptions_seen: ids.length,
      bmp_seen: blockBmp,
      scenes_found: blockScenes,
      scanned_at: new Date().toISOString(),
    });
  }

  await db.from("bss_block_scan").upsert(rows, { onConflict: "block_height" });
  return { skipped: false, blocks: heights, inscriptions, bmpSeen, scenesFound };
}

/** Sweep coverage, for display. */
export async function bssSweepProgress() {
  const db = await admin();
  const { data } = await db
    .from("bss_block_scan")
    .select("block_height, inscriptions_seen, bmp_seen, scenes_found")
    .order("block_height", { ascending: false })
    .limit(20_000);
  const rows = data ?? [];
  return {
    blocksSwept: rows.length,
    inscriptionsSeen: rows.reduce((sum, row) => sum + (row.inscriptions_seen ?? 0), 0),
    bmpSeen: rows.reduce((sum, row) => sum + (row.bmp_seen ?? 0), 0),
    scenesFound: rows.reduce((sum, row) => sum + (row.scenes_found ?? 0), 0),
    newestBlock: rows[0]?.block_height ? Number(rows[0].block_height) : null,
  };
}
