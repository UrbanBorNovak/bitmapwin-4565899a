/**
 * INSCRIBED.SPACE ARCHIVE — the public ordengine/inscribedspace_backup scene exports
 * (build_<height>.json), converted into the Geometry Bridge format. These are an
 * attributed archive, not chain proof: they never imply Tag 3 parentage or ownership.
 * Only models hosted on ordinals.com/content are kept, so every mesh still comes from chain.
 */
import type { WorldAsset, WorldGeometry, WorldPrim } from "@/lib/inscribed-world-bridge";

export const ARCHIVE_SOURCE = "https://github.com/ordengine/inscribedspace_backup";
export const ARCHIVE_LABEL = "INSCRIBED.SPACE ARCHIVE";

type V = { x?: number; y?: number; z?: number } | undefined;
type Item = { p?: V; r?: V; s?: V; col?: string; asset?: string };
export type BackupBuild = {
  app?: Array<{ player?: V }>;
  model?: Item[];
  box?: Item[];
  solidbox?: Item[];
  ground?: Item[];
  solidground?: Item[];
};

const HEX = /^#[0-9a-f]{6}$/i;
const ORD_ID = /^https:\/\/ordinals\.com\/content\/([0-9a-f]{64}i\d+)$/;
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : 0);
const v3 = (v: V, d = 0): [number, number, number] => [n(v?.x) || d, n(v?.y) || d, n(v?.z) || d];
const abs3 = (v: V): [number, number, number] => v3(v, 1).map((x) => Math.abs(x) || 1) as [number, number, number];

/** Converts one backup export. Textured parts keep a neutral stone colour. */
/** Widest primitive an archive build may keep (creator units). */
export const MAX_SLAB_SPAN = 150;

export function convertBackupBuild(b: BackupBuild): WorldGeometry {
  const prims: WorldPrim[] = [];
  const add = (list: Item[] | undefined, shape: WorldPrim["shape"]) => {
    for (const it of list ?? []) {
      if (prims.length >= 2000) return;
      const s = abs3(it.s);
      // Mega slabs (editor ground, 1,000-unit floors) would slice across neighbouring districts.
      if (shape === "box" && Math.max(s[0], s[2]) > MAX_SLAB_SPAN) continue;
      prims.push({ shape, color: it.col && HEX.test(it.col) ? it.col.toLowerCase() : "#9a9a9a", pos: v3(it.p), rot: v3(it.r), size: abs3(it.s) });
    }
  };
  add(b.solidground, "plane");
  add(b.ground, "plane");
  add(b.solidbox, "box");
  add(b.box, "box");
  let assets = 0;
  const models: WorldAsset[] = [];
  for (const m of b.model ?? []) {
    assets++;
    const id = typeof m.asset === "string" ? m.asset.match(ORD_ID)?.[1] : null;
    if (!id || models.length >= 400) continue;
    models.push({ url: `https://ordinals.com/content/${id}`, pos: v3(m.p), rot: v3(m.r), scale: v3(m.s, 1) });
  }
  return { prims, assets, models, sky: null, ground: null };
}

/** Vendored archive, loaded lazily (server side) so it never enters the page bundle. */
export async function archiveGeometryFor(height: number): Promise<WorldGeometry | null> {
  const pack = (await import("@/lib/vendor/inscribedspace-archive.json")).default as unknown as Record<string, BackupBuild>;
  const b = pack[String(height)];
  if (!b) return null;
  const geo = convertBackupBuild(b);
  return geo.prims.length || geo.models?.length ? geo : null;
}
