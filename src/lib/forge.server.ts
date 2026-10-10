/**
 * Finds the newest Land Forge build inscribed as a child of a BITMAP.
 * Only children listed by ordinals.com under the bitmap inscription count, so
 * the parent claim (proof the holder made it) is checked by Ordinals itself.
 */
import { FORGE_FORMAT } from "@/lib/voxel-populate";

const ORD = "https://ordinals.com";
const TTL = 15 * 60_000;
const MAX_BYTES = 120_000;

export type ForgeBuild = { inscriptionId: string; archetype: string | null; data: string; blockCount: number };
const cache = new Map<number, { expires: number; value: ForgeBuild | null }>();

async function ord(path: string): Promise<Response | null> {
  try {
    const r = await fetch(`${ORD}${path}`, { headers: { "user-agent": "bitmapwin/1.0", accept: "application/json, */*" }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

export function parseForgeHtml(html: string): { archetype: string | null; data: string } | null {
  const m = html.match(/<script id="bwvx"[^>]*data-format="([^"]+)"[^>]*>([A-Za-z0-9+/=\s]+)<\/script>/);
  if (!m || m[1] !== FORGE_FORMAT) return null;
  const meta = html.match(/<meta name="bitmapwin" content="[^;"]+;\d+;([a-z]+)"/);
  return { archetype: meta?.[1] ?? null, data: m[2]!.trim() };
}

export async function forgeBuildForHeight(height: number): Promise<ForgeBuild | null> {
  const hit = cache.get(height);
  if (hit && hit.expires > Date.now()) return hit.value;
  const put = (value: ForgeBuild | null) => (cache.set(height, { expires: Date.now() + TTL, value }), value);

  let parent: string | null = null;
  try {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    parent = (await locateBitmapHolder(height)).inscriptionId;
  } catch {
    return put(null);
  }
  if (!parent) return put(null);

  const ids: string[] = [];
  for (let page = 0; page < 4; page++) {
    const r = await ord(`/r/children/${parent}/inscriptions/${page}`);
    if (!r) break;
    const j = (await r.json()) as { children?: Array<{ id: string }>; more?: boolean };
    for (const c of j.children ?? []) if (c?.id) ids.push(c.id);
    if (!j.more) break;
  }
  for (const id of ids.reverse().slice(0, 12)) {
    const r = await ord(`/content/${id}`);
    if (!r || !(r.headers.get("content-type") ?? "").includes("html")) continue;
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) continue;
    const parsed = parseForgeHtml(new TextDecoder().decode(buf));
    if (!parsed) continue;
    const build = { inscriptionId: id, archetype: parsed.archetype, data: parsed.data, blockCount: Math.floor(atob(parsed.data).length / 4) };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("bitmap_forge_builds").upsert(
        { bitmap_height: height, inscription_id: id, archetype: build.archetype, block_count: build.blockCount, verified_at: new Date().toISOString() },
        { onConflict: "bitmap_height" },
      );
    } catch {
      // the build still renders when the directory write fails
    }
    return put(build);
  }
  return put(null);
}
