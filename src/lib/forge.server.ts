/**
 * Finds the active Land Forge build of a BITMAP: the newest reinscription on the
 * BITMAP's own sat (/r/sat/<sat>/at/-1, one hop). Only the sat's holder can
 * reinscribe it, so Bitcoin itself proves the owner made it. Older child-style
 * builds are still read as a fallback.
 */
import { FORGE_FORMAT, decodeBuild } from "@/lib/voxel-populate";
import { FORGE_MASTER_DELEGATE_ID, isForgeMasterDelegate, parseForgeMeta, type ForgeMeta } from "@/lib/forge-delegate";
import { encodeBuildBest } from "@/lib/voxel-populate";
import { isInscriptionId, parseAssemblyHtml, placePart, type AsmPart } from "@/lib/forge-assembly";
import type { TplBlock } from "@/lib/voxel-templates";

/** Voxels of any inscribed Land Forge piece (delegate metadata or self-rendering HTML). */
export async function forgePieceBlocks(id: string): Promise<TplBlock[] | null> {
  if (!isInscriptionId(id)) return null;
  const m = await ord(`/r/metadata/${id}`);
  const hexStr = m ? ((await m.json().catch(() => null)) as string | null) : null;
  const meta = typeof hexStr === "string" ? parseForgeMeta(hexStr) : null;
  if (meta) return decodeBuild(meta.d);
  const r = await ord(`/content/${id}`);
  if (!r || !(r.headers.get("content-type") ?? "").includes("html")) return null;
  const buf = await r.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) return null;
  const p = parseForgeHtml(new TextDecoder().decode(buf));
  return p ? decodeBuild(p.data) : null;
}

/** Resolves every referenced piece (one level deep) and returns one flat payload. */
async function flattenAssembly(parts: AsmPart[], own: string): Promise<string> {
  const all: TplBlock[] = own ? decodeBuild(own) : [];
  const pieces = await Promise.all(parts.map((p) => forgePieceBlocks(p.id)));
  parts.forEach((p, i) => { const b = pieces[i]; if (b) all.push(...placePart(b, p)); });
  return encodeBuildBest(all).data;
}

/** Delegated (Tag 11) build: no body, bytes live in Tag 5 metadata. */
async function delegateMeta(id: string): Promise<ForgeMeta | null> {
  if (!FORGE_MASTER_DELEGATE_ID) return null;
  const info = await ord(`/r/inscription/${id}`);
  const j = info ? ((await info.json().catch(() => null)) as { delegate?: string | null } | null) : null;
  // Accept both the V2 master and the original V1 master so older Lean builds keep resolving.
  if (!isForgeMasterDelegate(j?.delegate)) return null;
  const m = await ord(`/r/metadata/${id}`);
  const hexStr = m ? ((await m.json().catch(() => null)) as string | null) : null;
  return typeof hexStr === "string" ? parseForgeMeta(hexStr) : null;
}

const ORD = "https://ordinals.com";
const TTL = 15 * 60_000;
const MAX_BYTES = 120_000;

export type ForgeBuild = { sat: string | null; inscriptionId: string; archetype: string | null; data: string; blockCount: number };
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
  if (!m || (m[1] !== FORGE_FORMAT && m[1] !== "BWVX2")) return null;
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
  let sat: string | null = null;
  const meta = await ord(`/r/inscription/${parent}`);
  if (meta) {
    const j = (await meta.json().catch(() => null)) as { sat?: number | string | null } | null;
    sat = j?.sat != null ? String(j.sat) : null;
  }
  if (sat) {
    // newest first: at/-1, then the rest of the sat's reinscriptions
    const latest = await ord(`/r/sat/${sat}/at/-1`);
    const lj = latest ? ((await latest.json().catch(() => null)) as { id?: string } | null) : null;
    const satIds: string[] = [];
    if (lj?.id && lj.id !== parent) satIds.push(lj.id);
    const list = await ord(`/r/sat/${sat}`);
    const all = list ? ((await list.json().catch(() => null)) as { ids?: string[] } | null) : null;
    for (const id of [...(all?.ids ?? [])].reverse()) if (id !== parent && !satIds.includes(id)) satIds.push(id);
    const hit = await firstForge(satIds.slice(0, 8), height, sat);
    if (hit) return put(hit);
  }
  for (let page = 0; page < 4; page++) {
    const r = await ord(`/r/children/${parent}/inscriptions/${page}`);
    if (!r) break;
    const j = (await r.json()) as { children?: Array<{ id: string }>; more?: boolean };
    for (const c of j.children ?? []) if (c?.id) ids.push(c.id);
    if (!j.more) break;
  }
  return put(await firstForge(ids.reverse().slice(0, 12), height, null));
}

async function firstForge(ids: string[], height: number, sat: string | null): Promise<ForgeBuild | null> {
  for (const id of ids) {
    const dm = await delegateMeta(id);
    let parsed: { archetype: string | null; data: string } | null = dm && dm.h === height ? { archetype: "studio", data: dm.d } : null;
    if (!parsed) {
      const r = await ord(`/content/${id}`);
      if (!r || !(r.headers.get("content-type") ?? "").includes("html")) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) continue;
      const text = new TextDecoder().decode(buf);
      parsed = parseForgeHtml(text);
      if (!parsed) {
        const asm = parseAssemblyHtml(text);
        if (asm && asm.height === height) parsed = { archetype: "assembly", data: await flattenAssembly(asm.parts, asm.own) };
      }
    }
    if (!parsed) continue;
    const build = { sat, inscriptionId: id, archetype: parsed.archetype, data: parsed.data, blockCount: decodeBuild(parsed.data).length };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("bitmap_forge_builds").upsert(
        { bitmap_height: height, sat, inscription_id: id, archetype: build.archetype, block_count: build.blockCount, verified_at: new Date().toISOString() },
        { onConflict: "bitmap_height" },
      );
    } catch {
      // the build still renders when the directory write fails
    }
    try {
      // Chain-verified build → Atlas landmark (idempotent per inscription).
      const { appendProvenance } = await import("@/lib/passport.server");
      await appendProvenance({ sourceKey: `forge:${id}`, eventType: "build", bitmapHeight: height, sourceType: "forge_build", sourceId: id, proofLevel: "CHAIN", title: "INSCRIBED BUILD", summary: `${build.blockCount} voxels inscribed on ${height}.BITMAP`, metadata: { inscriptionId: id, sat, voxels: build.blockCount } });
    } catch {
      // landmark registration is best-effort
    }
    return build;
  }
  return null;
}

export type ParcelForgeBuild = { index: number; rect: [number, number, number, number]; inscriptionId: string; sat: string; data: string };
export type LandHtml = { inscriptionId: string; source: "bitmap" | "parcel"; index: number | null };
export type ForgeLand = { parcels: ParcelForgeBuild[]; html: LandHtml[] };
const landCache = new Map<number, { expires: number; value: ForgeLand }>();

async function satLatest(inscriptionId: string): Promise<{ sat: string; latest: string } | null> {
  const m = await ord(`/r/inscription/${inscriptionId}`);
  const j = m ? ((await m.json().catch(() => null)) as { sat?: number | string | null } | null) : null;
  if (j?.sat == null) return null;
  const sat = String(j.sat);
  const l = await ord(`/r/sat/${sat}/at/-1`);
  const lj = l ? ((await l.json().catch(() => null)) as { id?: string } | null) : null;
  return lj?.id && lj.id !== inscriptionId ? { sat, latest: lj.id } : null;
}

async function htmlAt(id: string): Promise<string | null> {
  const r = await ord(`/content/${id}`);
  if (!r || !(r.headers.get("content-type") ?? "").includes("html")) return null;
  const buf = await r.arrayBuffer();
  return buf.byteLength > MAX_BYTES ? "" : new TextDecoder().decode(buf);
}

/** Parcel holders' builds (newest reinscription on each valid parcel's own sat) + every HTML found on the land. */
export async function forgeLandFor(height: number): Promise<ForgeLand> {
  const hit = landCache.get(height);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value: ForgeLand = { parcels: [], html: [] };
  const district = await forgeBuildForHeight(height).catch(() => null);
  if (district) value.html.push({ inscriptionId: district.inscriptionId, source: "bitmap", index: null });
  const { parcelHoldersFor } = await import("@/lib/parcel-fief.server");
  const holders = await parcelHoldersFor(height).catch(() => null);
  for (const p of (holders?.parcels ?? []).slice(0, 24)) {
    const s = await satLatest(p.inscriptionId);
    if (!s) continue;
    const dm = await delegateMeta(s.latest);
    const pm = dm?.p?.match(/^(\d+);(\d+),(\d+),(\d+),(\d+)$/);
    if (dm && pm && dm.h === height && Number(pm[1]) === p.index) {
      value.html.push({ inscriptionId: s.latest, source: "parcel", index: p.index });
      value.parcels.push({ index: p.index, rect: [Number(pm[2]), Number(pm[3]), Number(pm[4]), Number(pm[5])], inscriptionId: s.latest, sat: s.sat, data: dm.d });
      continue;
    }
    const html = await htmlAt(s.latest);
    if (html === null) continue;
    value.html.push({ inscriptionId: s.latest, source: "parcel", index: p.index });
    const parsed = html ? parseForgeHtml(html) : null;
    const meta = html.match(/<meta name="bitmapwin-parcel" content="(\d+);(\d+),(\d+),(\d+),(\d+)"/);
    if (!parsed || !meta || Number(meta[1]) !== p.index) continue;
    value.parcels.push({ index: p.index, rect: [Number(meta[2]), Number(meta[3]), Number(meta[4]), Number(meta[5])], inscriptionId: s.latest, sat: s.sat, data: parsed.data });
  }
  landCache.set(height, { expires: Date.now() + TTL, value });
  return value;
}
