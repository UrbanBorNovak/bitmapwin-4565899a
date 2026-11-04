/**
 * Resolves and decodes the BSS script of a BITMAP, server side.
 *
 * The script is a child inscription of the bitmap whose content is a BMP that
 * carries the compiled scene. Nothing here is executed — bytes in, scene data
 * out. Decoded scenes are cached per inscription so the same script is never
 * fetched twice.
 */

import { bssDecode } from "@/lib/bss/format";
import type { BssLoad, BssScene } from "@/lib/bss/types";

const ORD = "https://ordinals.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TTL = 30 * 60_000;
const MAX_CHILD_PAGES = 4;
const MAX_BMP_BYTES = 2_000_000;

const sceneCache = new Map<string, { expires: number; value: BssLoad }>();

async function recordVerifiedScene(height: number, scene: BssScene) {
  if (!scene.ok) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bitmap_bss_scenes").upsert(
      {
        bitmap_height: height,
        bmp_inscription_id: scene.source,
        version_label: scene.versionLabel,
        object_count: scene.objects.length,
        resource_count: scene.resources.length,
        is_valid: true,
        verified_at: new Date().toISOString(),
      },
      { onConflict: "bitmap_height" },
    );
  } catch {
    // The live scene still renders when the directory is temporarily unavailable.
  }
}

async function ordFetch(path: string, attempts = 2): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await fetch(`${ORD}${path}`, {
        headers: { "user-agent": UA, accept: "application/json, */*" },
      });
      if (resp.ok) return resp;
      if (resp.status === 404) return null;
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    } catch {
      await new Promise((r) => setTimeout(r, 250 * (i + 1)));
    }
  }
  return null;
}

/** Fetches a BMP inscription and decodes it. */
export async function bssSceneFromInscription(inscriptionId: string): Promise<BssLoad> {
  const cached = sceneCache.get(inscriptionId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const put = (value: BssLoad) => {
    sceneCache.set(inscriptionId, { expires: Date.now() + TTL, value });
    return value;
  };

  const resp = await ordFetch(`/content/${inscriptionId}`);
  if (!resp) return put({ status: "error", reason: "Script inscription could not be fetched", source: inscriptionId });
  const buffer = await resp.arrayBuffer();
  if (buffer.byteLength > MAX_BMP_BYTES)
    return put({ status: "error", reason: "Script inscription is too large to decode", source: inscriptionId });

  const decoded = bssDecode(new Uint8Array(buffer), inscriptionId);
  if ("error" in decoded) return put({ status: "error", reason: decoded.error, source: inscriptionId });
  return put({ status: "ok", scene: decoded as BssScene });
}

type ChildRow = { id: string };

/** Finds the newest BMP child inscription of a bitmap: its live BSS script. */
async function findScriptInscription(bitmapInscription: string): Promise<string | null> {
  const ids: string[] = [];
  for (let page = 0; page < MAX_CHILD_PAGES; page++) {
    const resp = await ordFetch(`/r/children/${bitmapInscription}/inscriptions/${page}`);
    if (!resp) break;
    const json = (await resp.json()) as { children?: ChildRow[]; more?: boolean };
    const rows = json.children ?? [];
    for (const row of rows) if (row?.id) ids.push(row.id);
    if (!json.more || rows.length === 0) break;
  }
  // Newest first: a bitmap's scene is replaced by inscribing a newer script.
  for (const id of ids.reverse()) {
    const head = await ordFetch(`/content/${id}`, 1);
    if (!head) continue;
    const type = (head.headers.get("content-type") ?? "").toLowerCase();
    if (!type.includes("bmp")) continue;
    const buffer = await head.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const decoded = bssDecode(bytes, id);
    if ("error" in decoded) continue;
    sceneCache.set(id, { expires: Date.now() + TTL, value: { status: "ok", scene: decoded } });
    return id;
  }
  return null;
}

/**
 * Reads the BSS scene of a BITMAP whose inscription is already known (the
 * discovery crawler has it indexed), skipping the holder lookup.
 */
export async function bssSceneForBitmapInscription(
  height: number,
  bitmapInscription: string,
): Promise<BssLoad> {
  const script = await findScriptInscription(bitmapInscription);
  if (!script) return { status: "none", reason: "This BITMAP has no BSS script inscribed on it" };
  const loaded = await bssSceneFromInscription(script);
  if (loaded.status === "ok") await recordVerifiedScene(height, loaded.scene);
  return loaded;
}

const lookupCache = new Map<number, { expires: number; value: BssLoad }>();

/** Reads the BSS scene published on a BITMAP, if it has one. */
export async function bssSceneForHeight(height: number): Promise<BssLoad> {
  const cached = lookupCache.get(height);
  if (cached && cached.expires > Date.now()) return cached.value;
  const put = (value: BssLoad) => {
    lookupCache.set(height, { expires: Date.now() + TTL, value });
    return value;
  };

  let bitmapInscription: string | null = null;
  try {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    bitmapInscription = (await locateBitmapHolder(height)).inscriptionId;
  } catch {
    return put({ status: "none", reason: `${height}.bitmap is not inscribed or not indexed yet` });
  }
  if (!bitmapInscription) return put({ status: "none", reason: "No bitmap inscription found" });

  const script = await findScriptInscription(bitmapInscription);
  if (!script) return put({ status: "none", reason: "This BITMAP has no BSS script inscribed on it" });
  const loaded = await bssSceneFromInscription(script);
  if (loaded.status === "ok") await recordVerifiedScene(height, loaded.scene);
  return put(loaded);
}
