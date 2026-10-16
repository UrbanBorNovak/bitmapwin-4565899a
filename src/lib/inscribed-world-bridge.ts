/**
 * GEOMETRY BRIDGE — decodes an Inscribed.space world's on-chain `worldData`
 * (Base91 + gzip) into its primitive boxes/planes so the Oasis can draw the
 * creator's architecture on the BITMAP. Draco model assets are counted, not
 * drawn: they only run inside the creator's own engine (the portal).
 */

const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const TABLE = new Map([...B91].map((c, i) => [c, i]));

export function base91Decode(s: string): Uint8Array {
  let v = -1, b = 0, n = 0;
  const out: number[] = [];
  for (const ch of s) {
    const c = TABLE.get(ch);
    if (c === undefined) continue;
    if (v < 0) { v = c; continue; }
    v += c * 91;
    b |= v << n;
    n += (v & 8191) > 88 ? 13 : 14;
    do { out.push(b & 255); b >>>= 8; n -= 8; } while (n > 7);
    v = -1;
  }
  if (v + 1) out.push((b | (v << n)) & 255);
  return new Uint8Array(out);
}

/** Pulls the quoted `worldData` literal out of the world's HTML. */
export function extractWorldData(html: string): string | null {
  const m = html.match(/worldData\s*=\s*(['"`])([\s\S]*?)\1\s*;/);
  return m?.[2] ? m[2].replace(/\s+/g, "") : null;
}

export async function gunzip(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

export type WorldPrim = {
  shape: "box" | "plane";
  color: string;
  pos: [number, number, number];
  rot: [number, number, number]; // degrees
  size: [number, number, number];
};

/** One placed on-chain model (Draco glTF inscription) with its editor transform. */
export type WorldAsset = {
  url: string;
  pos: [number, number, number];
  rot: [number, number, number]; // degrees
  scale: [number, number, number];
};

export type WorldGeometry = {
  prims: WorldPrim[];
  assets: number;
  models?: WorldAsset[];
  sky: string | null;
  ground: string | null;
};

function statement(src: string, name: string): unknown {
  const m = src.match(new RegExp(`\\b${name}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;`));
  if (!m?.[1]) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const HEX = /^#[0-9a-f]{3,8}$/i;

/** Parses decompressed worldData source. Pure. */
export function parseWorldSource(src: string): WorldGeometry {
  const colors = new Map<string, string>();
  for (const c of (statement(src, "appColors") as unknown[][] | null) ?? []) {
    if (typeof c?.[0] === "string" && typeof c[1] === "string" && HEX.test(c[1])) colors.set(c[0], c[1]);
  }
  const app = (statement(src, "appData") as unknown[] | null) ?? [];
  const modelUrl = new Map<string, string>();
  for (const m of (statement(src, "appModels") as { a?: unknown; u?: unknown }[] | null) ?? []) {
    if (typeof m?.a === "string" && typeof m.u === "string" && /^\/content\/[0-9a-f]{64}i\d+$/.test(m.u)) {
      modelUrl.set(m.a, `https://ordinals.com${m.u}`);
    }
  }
  const models: WorldAsset[] = [];
  const objs = (statement(src, "appObjects") as unknown[][] | null) ?? [];
  const prims: WorldPrim[] = [];
  let assets = 0;
  for (const o of objs) {
    if (!Array.isArray(o)) continue;
    if (o[3] === "asset") {
      assets++;
      const url = modelUrl.get(String(o[1]));
      if (url && models.length < 400) {
        models.push({
          url,
          pos: [num(o[4]), num(o[5]), num(o[6])],
          rot: [num(o[7]), num(o[8]), num(o[9])],
          scale: [num(o[10]) || 1, num(o[11]) || 1, num(o[12]) || 1],
        });
      }
      continue;
    }
    if (o[3] !== "box" && o[3] !== "plane") continue;
    prims.push({
      shape: o[3],
      color: colors.get(String(o[1])) ?? "#9a9a9a",
      pos: [num(o[4]), num(o[5]), num(o[6])],
      rot: [num(o[7]), num(o[8]), num(o[9])],
      size: [Math.abs(num(o[10])) || 1, Math.abs(num(o[11])) || 1, Math.abs(num(o[12])) || 1],
    });
    if (prims.length >= 2000) break;
  }
  const hex = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : null);
  return { prims, assets, models, sky: hex(app[3]), ground: hex(app[4]) };
}

export async function decodeWorldGeometry(html: string): Promise<WorldGeometry | null> {
  const raw = extractWorldData(html);
  if (!raw) return null;
  try {
    return parseWorldSource(await gunzip(base91Decode(raw)));
  } catch {
    return null;
  }
}

/** Editor floor tiles (huge flat planes) belong to the creator's scene, not the building. */
export function isFloorPlane(p: WorldPrim): boolean {
  return p.shape === "plane" && Math.max(p.size[0], p.size[2]) >= 100;
}

/** The building only: drops editor floor planes so they never slice through the Oasis view. */
export function structurePrims(prims: WorldPrim[]): WorldPrim[] {
  const floors = prims.filter(isFloorPlane);
  // Creator's ground level: the editor floor planes. Wide slabs sitting at/below it are
  // terrain foundations in their engine and would show as a huge grey block in the Oasis.
  const floorY = floors.length ? Math.min(...floors.map((p) => p.pos[1])) : null;
  const kept = prims.filter((p) => {
    if (isFloorPlane(p)) return false;
    if (floorY === null) return true;
    if (p.pos[1] + p.size[1] / 2 < floorY - 0.5) return false; // fully underground
    const wide = Math.max(p.size[0], p.size[2]) >= 40;
    return !(wide && p.pos[1] <= floorY + 5);
  });
  const base = kept.length ? kept : prims;
  // Drop stray editor markers far from the building cluster so they can't shrink the fit.
  const med = (k: 0 | 2) => {
    const v = base.map((p) => p.pos[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  };
  const cx = med(0), cz = med(2);
  const near = base.filter((p) => Math.hypot(p.pos[0] - cx, p.pos[2] - cz) <= 150);
  return near.length ? near : base;
}

/** Creator scale above which a model is a runaway sky/horizon prop, never part of the land. */
export const MAX_MODEL_SCALE = 100;

/**
 * Models that land inside the BITMAP once the building is fitted (local units, before offset).
 * Runaway scales (sky domes, 1,000,000-unit props) are dropped so nothing spills over neighbours.
 */
export function modelsInside(models: WorldAsset[], fit: { scale: number; offset: [number, number, number] }, half: number): WorldAsset[] {
  return models.filter((m) =>
    m.scale.every((s) => Number.isFinite(s) && Math.abs(s) <= MAX_MODEL_SCALE) &&
    Math.abs((m.pos[0] + fit.offset[0]) * fit.scale) <= half &&
    Math.abs((m.pos[2] + fit.offset[2]) * fit.scale) <= half,
  );
}

/**
 * The level the building actually stands on: the top of the creator's foundation slabs
 * (wide boxes at their floor, dropped from drawing) or the editor floor planes. Null when none.
 */
export function creatorFloorY(prims: WorldPrim[]): number | null {
  const floors = prims.filter(isFloorPlane);
  if (!floors.length) return null;
  const floorY = Math.min(...floors.map((p) => p.pos[1]));
  let top = floorY;
  for (const p of prims) {
    if (p.shape !== "box" || Math.max(p.size[0], p.size[2]) < 40 || p.pos[1] > floorY + 5) continue;
    top = Math.max(top, p.pos[1] + p.size[1] / 2);
  }
  return top;
}

/**
 * Uniform scale + offset that fits the primitives inside `fit` world units.
 * With `floorY` the creator's ground lands on y=0 (parts below it sink into the terrain,
 * like in their engine); otherwise the lowest part rests on y=0.
 */
export function fitPrims(prims: WorldPrim[], fit: number, floorY: number | null = null) {
  if (!prims.length) return { scale: 1, offset: [0, 0, 0] as [number, number, number] };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of prims) {
    const r = Math.max(p.size[0], p.size[2]) / 2;
    x0 = Math.min(x0, p.pos[0] - r); x1 = Math.max(x1, p.pos[0] + r);
    z0 = Math.min(z0, p.pos[2] - r); z1 = Math.max(z1, p.pos[2] + r);
    y0 = Math.min(y0, p.pos[1] - p.size[1] / 2);
  }
  const scale = fit / Math.max(x1 - x0, z1 - z0, 1);
  const base = floorY ?? y0;
  return { scale, offset: [0 - (x0 + x1) / 2, 0 - base, 0 - (z0 + z1) / 2] as [number, number, number] };
}
