import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

let holderCache: { count: number; at: number } | null = null;

/** Current Emporium holders = distinct addresses holding an image child of 717328.bitmap, read from ordinals.com. */
export const emporiumHolderCountFn = createServerFn({ method: "GET" }).handler(async () => {
  if (holderCache && Date.now() - holderCache.at < 3 * 3600_000) return { count: holderCache.count, checkedAt: new Date(holderCache.at).toISOString() };
  try {
    const { emporiumPortraitHolders } = await import("@/lib/emporium.server");
    const holders = await emporiumPortraitHolders();
    holderCache = { count: holders.size, at: Date.now() };
    return { count: holders.size, checkedAt: new Date().toISOString() };
  } catch {
    return { count: null as number | null, checkedAt: null as string | null };
  }
});

/** Holders-only door: a fresh BIP-322 signature proves the wallet; residency is re-read from chain every time. Writes nothing. */
export const enterEmporiumEmbassyFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      address: z.string().regex(/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/),
      issuedAt: z.string().max(40),
      signature: z.string().min(8).max(2000),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { embassyMessage, EMBASSY_TTL_MS } = await import("@/lib/embassy");
    const issued = Date.parse(data.issuedAt);
    if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > EMBASSY_TTL_MS) return { ok: false as const, error: "Signature expired — try again" };
    const { Verifier } = await import("bip322-js");
    let valid = false;
    try { valid = Verifier.verifySignature(data.address, embassyMessage("Emporium", data.address, data.issuedAt), data.signature); } catch { valid = false; }
    if (!valid) return { ok: false as const, error: "Signature does not match this address" };
    const { verifyEmporiumResident } = await import("@/lib/emporium.server");
    const r = await verifyEmporiumResident(data.address);
    if (!r.resident) return { ok: false as const, error: "NOT_HOLDER" };
    return { ok: true as const, portraits: r.portraits, parcels: r.parcels.map((p) => p.index) };
  });
