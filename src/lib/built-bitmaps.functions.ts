import { createServerFn } from "@tanstack/react-start";

export type BuiltSource = "forge" | "archive" | "page" | "voxels";
export type BuiltBitmap = { height: number; sources: BuiltSource[] };
export type WorldVoxel = { x: number; y: number; z: number; kind: string };

/**
 * Public: every BITMAP with something built on it — chain-verified Land Forge
 * builds, the attributed Inscribed.space archive, owner build pages, and land
 * carrying placed Oasis voxels — plus the placed voxels themselves (no account columns).
 */
export const getBuiltWorldFn = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { colAt, rowAt, WORLD_GRID } = await import("@/lib/player-state");
  const { VOXEL } = await import("@/lib/voxel-world");
  const map = new Map<number, Set<BuiltSource>>();
  const add = (h: number, s: BuiltSource) => {
    if (!Number.isFinite(h) || h < 0) return;
    (map.get(h) ?? map.set(h, new Set()).get(h)!).add(s);
  };

  const [forge, pages, voxels] = await Promise.all([
    sb.from("bitmap_forge_builds").select("bitmap_height").limit(5000),
    sb.from("parcel_pages").select("bitmap_height").limit(5000),
    sb.from("oasis_voxels").select("x, y, z, kind").limit(20000),
  ]);
  for (const r of forge.data ?? []) add(Number(r.bitmap_height), "forge");
  for (const r of pages.data ?? []) add(Number(r.bitmap_height), "page");
  const pack = (await import("@/lib/vendor/inscribedspace-archive.json")).default as unknown as Record<string, unknown>;
  for (const k of Object.keys(pack)) add(Number(k), "archive");

  const blocks = (voxels.data ?? []) as WorldVoxel[];
  for (const v of blocks) {
    if (v.kind === "air") continue;
    add(rowAt(v.z * VOXEL) * WORLD_GRID + colAt(v.x * VOXEL), "voxels");
  }
  const built: BuiltBitmap[] = [...map].map(([height, s]) => ({ height, sources: [...s] })).sort((a, b) => a.height - b.height);
  return { built, voxels: blocks.filter((v) => v.kind !== "air") };
});
