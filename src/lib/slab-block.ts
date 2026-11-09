import { layoutFromSizeClasses } from "@/lib/bitmap-layout";
import { gradeSlab, type SlabGrade } from "@/lib/land-slab";

export async function fetchBlock(height: number) {
  const r = await fetch(`/api/public/blocks/${height}`);
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`block ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  return {
    classes: Array.from(bytes),
    hash: r.headers.get("x-block-hash"),
    txCount: Number(r.headers.get("x-tx-count") ?? bytes.length) || bytes.length,
  };
}

/** Pre-grade from the same block facts the certificate will carry. */
export async function fetchSlabGrade(height: number): Promise<{ grade: SlabGrade; hash: string | null; txCount: number } | null> {
  const b = await fetchBlock(height);
  if (!b || b.classes.length === 0) return null;
  const layout = layoutFromSizeClasses(b.classes);
  return { grade: gradeSlab({ height, txCount: b.txCount, hash: b.hash, layoutWidth: layout.width, layoutHeight: layout.height, parcelSizes: layout.parcels.map((p) => p.size) }), hash: b.hash, txCount: b.txCount };
}
