import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AlbumSlab = {
  id: string;
  h: number;
  grade: number;
  name: string;
  cert: string;
  subs: Record<string, number>;
  /** true only when ordinals.com lists the indexed `<h>.bitmap` as this child's parent */
  parentProven: boolean;
};

export type AlbumBitmap = { id: string; h: number };

/**
 * Reads an address's slab album straight from chain: certificate children it
 * holds (content must parse as BW-SLAB-1) plus the BITMAPs it can still grade.
 */
export const slabAlbumFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ address: z.string().trim().regex(/^(bc1[a-z0-9]{8,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { fetchWallet } = await import("@/lib/wallet.server");
    const { ordContent } = await import("@/lib/ord-fallback.server");
    const { claimsForHeights } = await import("@/lib/atlas-land.server");
    const { parseSlabCert } = await import("@/lib/slab-cert");
    const wallet = await fetchWallet(data.address).catch(() => null);
    if (!wallet) return { ok: false as const, slabs: [] as AlbumSlab[], bitmaps: [] as AlbumBitmap[] };
    const all = wallet.utxos.flatMap((u) => u.inscriptions);
    const bitmaps: AlbumBitmap[] = all
      .filter((i) => i.bitmapHeight != null && !i.parcel)
      .map((i) => ({ id: i.id, h: i.bitmapHeight! }));
    const candidates = all.filter((i) => i.bitmapHeight == null && (i.contentType ?? "").startsWith("text/html")).slice(0, 60);

    const found: (Omit<AlbumSlab, "parentProven"> & { parents: string[] })[] = [];
    await Promise.all(
      candidates.map(async (c) => {
        const r = await ordContent(c.id).catch(() => null);
        if (!r || !r.ok) return;
        const f = parseSlabCert((await r.text()).slice(0, 8000));
        if (!f) return;
        const p = await fetch(`https://ordinals.com/r/parents/${c.id}`, { signal: AbortSignal.timeout(8000) })
          .then((x) => (x.ok ? (x.json() as Promise<{ ids?: string[] }>) : null))
          .catch(() => null);
        found.push({ id: c.id, h: f.h, grade: f.grade, name: f.name, cert: f.cert, subs: f.subs, parents: p?.ids ?? [] });
      }),
    );
    const claims = await claimsForHeights([...new Set(found.map((s) => s.h))]);
    const canonical = new Map(claims.filter((c) => c.isValid).map((c) => [c.height, c.inscriptionId]));
    const slabs: AlbumSlab[] = found
      .map(({ parents, ...s }) => ({ ...s, parentProven: parents.includes(canonical.get(s.h) ?? "-") }))
      .sort((a, b) => b.grade - a.grade || a.h - b.h);
    return { ok: true as const, slabs, bitmaps: bitmaps.sort((a, b) => a.h - b.h) };
  });
