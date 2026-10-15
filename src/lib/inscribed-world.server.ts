import { detectInscribedWorld, type WorldInfo } from "@/lib/inscribed-world";

const ORD = "https://ordinals.com";
const MAX_BYTES = 400_000;
const TTL = 15 * 60_000;

export type BitmapWorld = WorldInfo & { inscriptionId: string; source: "sat" | "child" };

async function ord(path: string): Promise<Response | null> {
  try {
    const r = await fetch(`${ORD}${path}`, { headers: { "user-agent": "bitmapwin/1.0", accept: "application/json, */*" }, signal: AbortSignal.timeout(10_000) });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

/** Reads one inscription's HTML from chain and detects a 3D world in it. */
export async function inspectWorld(id: string): Promise<WorldInfo | null> {
  const r = await ord(`/content/${id}`);
  if (!r || !(r.headers.get("content-type") ?? "").includes("html")) return null;
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return null;
  return detectInscribedWorld(new TextDecoder().decode(buf));
}

const cache = new Map<number, { expires: number; value: BitmapWorld[] }>();

/** Every world inscribed on a BITMAP: reinscriptions on its sat first, then its children. */
export async function worldsForHeight(height: number): Promise<BitmapWorld[]> {
  const hit = cache.get(height);
  if (hit && hit.expires > Date.now()) return hit.value;
  const put = (value: BitmapWorld[]) => (cache.set(height, { expires: Date.now() + TTL, value }), value);

  let parent: string | null = null;
  try {
    const { locateBitmapHolder } = await import("@/lib/locate-bitmap.server");
    parent = (await locateBitmapHolder(height)).inscriptionId;
  } catch {
    return put([]);
  }
  if (!parent) return put([]);

  const candidates: Array<{ id: string; source: "sat" | "child" }> = [];
  const meta = await ord(`/r/inscription/${parent}`);
  const sat = meta ? ((await meta.json().catch(() => null)) as { sat?: number | string | null } | null)?.sat : null;
  if (sat != null) {
    const list = await ord(`/r/sat/${sat}`);
    const ids = list ? ((await list.json().catch(() => null)) as { ids?: string[] } | null)?.ids ?? [] : [];
    for (const id of [...ids].reverse()) if (id !== parent) candidates.push({ id, source: "sat" });
  }
  for (let page = 0; page < 2; page++) {
    const r = await ord(`/r/children/${parent}/inscriptions/${page}`);
    if (!r) break;
    const j = (await r.json().catch(() => null)) as { children?: Array<{ id: string; content_type?: string | null }>; more?: boolean } | null;
    for (const c of [...(j?.children ?? [])].reverse()) {
      if (c?.id && (!c.content_type || c.content_type.includes("html"))) candidates.push({ id: c.id, source: "child" });
    }
    if (!j?.more) break;
  }

  const picked = candidates.slice(0, 16);
  const found = await Promise.all(picked.map((c) => inspectWorld(c.id)));
  return put(picked.flatMap((c, i) => (found[i] ? [{ ...found[i]!, inscriptionId: c.id, source: c.source }] : [])));
}

const geoCache = new Map<number, { expires: number; value: WorldGeometryHit | null }>();
export type WorldGeometryHit = { inscriptionId: string; title: string | null } & import("@/lib/inscribed-world-bridge").WorldGeometry;

/** Primitive geometry of the newest Inscribed.space world on a BITMAP, decoded from its on-chain worldData. */
export async function worldGeometryForHeight(height: number): Promise<WorldGeometryHit | null> {
  const hit = geoCache.get(height);
  if (hit && hit.expires > Date.now()) return hit.value;
  const put = (value: WorldGeometryHit | null) => (geoCache.set(height, { expires: Date.now() + TTL, value }), value);
  const world = (await worldsForHeight(height)).find((w) => w.engine === "inscribed.space");
  if (!world) return put(null);
  const r = await ord(`/content/${world.inscriptionId}`);
  if (!r) return put(null);
  const { decodeWorldGeometry } = await import("@/lib/inscribed-world-bridge");
  const geo = await decodeWorldGeometry(await r.text());
  return put(geo && geo.prims.length ? { inscriptionId: world.inscriptionId, title: world.title, ...geo } : null);
}
