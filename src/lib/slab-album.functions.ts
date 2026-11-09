import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AlbumSlab = {
  id: string;
  h: number;
  grade: number;
  name: string;
  cert: string;
  subs: Record<string, number>;
  /** true only when the slab sits on the sat of the indexed, valid `<h>.bitmap` */
  parentProven: boolean;
};

export type AlbumBitmap = { id: string; h: number };

const ORD = "https://ordinals.com";
const MAX_SCAN = 40;

async function ordJson<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(ORD + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Reads an address's slab album straight from chain: for each held BITMAP, the
 * newest BW-SLAB-1 reinscription on its own sat (checks the last 4 inscriptions).
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
    const bitmaps: AlbumBitmap[] = wallet.utxos
      .flatMap((u) => u.inscriptions)
      .filter((i) => i.bitmapHeight != null && !i.parcel)
      .map((i) => ({ id: i.id, h: i.bitmapHeight! }))
      .sort((a, b) => a.h - b.h);
    const claims = await claimsForHeights([...new Set(bitmaps.map((b) => b.h))]);
    const canonical = new Map(claims.filter((c) => c.isValid).map((c) => [c.height, c.inscriptionId]));

    const slabs: AlbumSlab[] = [];
    await Promise.all(
      bitmaps.slice(0, MAX_SCAN).map(async (b) => {
        const info = await ordJson<{ sat?: number | null }>(`/r/inscription/${b.id}`);
        if (info?.sat == null) return;
        for (let k = 1; k <= 4; k++) {
          const at = await ordJson<{ id?: string | null }>(`/r/sat/${info.sat}/at/-${k}`);
          if (!at?.id || at.id === b.id) return;
          const r = await ordContent(at.id).catch(() => null);
          if (!r || !r.ok) continue;
          const f = parseSlabCert((await r.text()).slice(0, 12000));
          if (!f || f.h !== b.h) continue;
          slabs.push({ id: at.id, h: f.h, grade: f.grade, name: f.name, cert: f.cert, subs: f.subs, parentProven: canonical.get(b.h) === b.id });
          return;
        }
      }),
    );
    slabs.sort((a, b) => b.grade - a.grade || a.h - b.h);
    return { ok: true as const, slabs, bitmaps };
  });
