// Verified community pieces = children of the master collection that decode as Land Forge voxels.
// Only parent-signed children qualify, so random inscriptions cannot spam the panel.
export const MASTER_COLLECTION_ID = "9d1da99caec6afbf69b89bdafdc0a7ab679c6dd67920f7b38d3a3fd116d0e21fi0";

export type CollectionPiece = { id: string; height: number | null; maker: string | null; voxels: number };

const ORD = "https://ordinals.com";
let cache: { expires: number; value: CollectionPiece[] } | null = null;

async function j<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(ORD + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

export async function collectionPieces(): Promise<CollectionPiece[]> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const ids: string[] = [];
  for (let page = 0; page < 10; page++) {
    const c = await j<{ ids: string[]; more: boolean }>(`/r/children/${MASTER_COLLECTION_ID}/${page}`);
    if (!c) break;
    ids.push(...c.ids);
    if (!c.more) break;
  }
  const { forgePieceBlocks } = await import("@/lib/forge.server");
  const out: CollectionPiece[] = [];
  await Promise.all(ids.slice(0, 200).map(async (id) => {
    const blocks = await forgePieceBlocks(id).catch(() => null);
    if (!blocks || blocks.length < 4 || blocks.length > 8000) return;
    // Royalties go to the creator: the address the reveal first delivered the inscription to.
    const reveal = await fetch(`https://mempool.space/api/tx/${id.slice(0, 64)}`, { signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? (r.json() as Promise<{ vout: { scriptpubkey_address?: string }[] }>) : null)).catch(() => null);
    const info = { address: reveal?.vout[0]?.scriptpubkey_address ?? null };
    const meta = await j<string>(`/r/metadata/${id}`);
    let height: number | null = null;
    if (typeof meta === "string") {
      const { parseForgeMeta } = await import("@/lib/forge-delegate");
      height = parseForgeMeta(meta)?.h ?? null;
    }
    out.push({ id, height, maker: info?.address ?? null, voxels: blocks.length });
  }));
  out.sort((a, b) => b.voxels - a.voxels);
  cache = { expires: Date.now() + 30 * 60_000, value: out };
  return out;
}
