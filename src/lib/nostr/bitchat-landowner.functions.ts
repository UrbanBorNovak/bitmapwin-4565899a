import { createServerFn } from "@tanstack/react-start";

type Item = { pubkey: string; address: string; signature: string; issuedAt: number; kind?: "land" | "parcel" };
/**
 * verified    = signature valid and custody confirmed by a live read just now.
 * unavailable = a custody source failed; no badge, and the same signature may be re-checked.
 * rejected    = signature invalid, proof expired, or the address does not hold it.
 */
export type RoomOwnerCheck = {
  ok: boolean;
  status: "verified" | "unavailable" | "rejected";
  reason?: string;
  address?: string;
  role?: "landowner" | "parcel";
  parcels?: number[];
  /** Server time (ms) of the live custody read behind this result. */
  checkedAt: number;
};

const ADDRESS = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/;
const goodHeight = (v: unknown) => {
  const h = Number(v);
  if (!Number.isInteger(h) || h < 0 || h > 2_000_000) throw new Error("bad height");
  return h;
};

/** Which proof the address can make in this room right now (public chain facts only). */
export const roomRoleFn = createServerFn({ method: "POST" })
  .inputValidator((d: { height: number; address: string }) => {
    if (!ADDRESS.test(String(d?.address ?? ""))) throw new Error("bad address");
    return { height: goodHeight(d?.height), address: String(d.address) };
  })
  .handler(async ({ data }): Promise<{ role: "landowner" | "parcel" | null; parcels: number[]; unavailable?: string | undefined }> => {
    const { bitmapHolderNow, liveParcelsHeldBy } = await import("@/lib/nostr/bitchat-landowner.server");
    const land = await bitmapHolderNow(data.height);
    if (land.status === "ok" && land.holder === data.address) return { role: "landowner", parcels: [] };
    const parcels = await liveParcelsHeldBy(data.height, data.address);
    if (parcels.status === "held") return { role: "parcel", parcels: parcels.parcels };
    const unavailable = land.status === "unavailable" ? land.reason : parcels.status === "unavailable" ? parcels.reason : undefined;
    return { role: null, parcels: [], unavailable };
  });

/** Public, stores nothing: checks the BIP-322 delegation, then live custody of the BITMAP or its parcels. */
export const verifyRoomOwnersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { height: number; items: Item[] }) => {
    const h = goodHeight(d?.height);
    const items = (Array.isArray(d?.items) ? d.items : []).slice(0, 20).filter((i) =>
      /^[0-9a-f]{64}$/.test(String(i?.pubkey)) && typeof i?.address === "string" && i.address.length < 100
      && typeof i?.signature === "string" && i.signature.length < 400 && Number.isInteger(i?.issuedAt))
      .map((i) => ({ ...i, kind: i.kind === "parcel" ? ("parcel" as const) : ("land" as const) }));
    return { height: h, items };
  })
  .handler(async ({ data }) => {
    const { roomProofMessage, proofFresh } = await import("@/lib/nostr/bitchat-landowner");
    const { bitmapHolderNow, liveParcelsHeldBy } = await import("@/lib/nostr/bitchat-landowner.server");
    const { Verifier } = await import("bip322-js");
    const now = Math.floor(Date.now() / 1000);
    let holder: ReturnType<typeof bitmapHolderNow> | undefined;
    const parcelsBy = new Map<string, ReturnType<typeof liveParcelsHeldBy>>();
    const out: Record<string, RoomOwnerCheck> = {};
    const reject = (reason: string): RoomOwnerCheck => ({ ok: false, status: "rejected", reason, checkedAt: Date.now() });
    const unavailable = (reason: string): RoomOwnerCheck => ({ ok: false, status: "unavailable", reason, checkedAt: Date.now() });
    for (const i of data.items) {
      if (!proofFresh(i.issuedAt, now)) { out[i.pubkey] = reject("proof expired"); continue; }
      let valid = false;
      try { valid = Verifier.verifySignature(i.address, roomProofMessage(i.kind, data.height, i.address, i.pubkey, i.issuedAt), i.signature); } catch { valid = false; }
      if (!valid) { out[i.pubkey] = reject("signature does not verify"); continue; }
      if (i.kind === "parcel") {
        if (!parcelsBy.has(i.address)) parcelsBy.set(i.address, liveParcelsHeldBy(data.height, i.address));
        const r = await parcelsBy.get(i.address)!;
        out[i.pubkey] = r.status === "held"
          ? { ok: true, status: "verified", address: i.address, role: "parcel", parcels: r.parcels, checkedAt: Date.now() }
          : r.status === "unavailable" ? unavailable(r.reason) : reject("address holds no valid parcel of this BITMAP right now");
        continue;
      }
      const h = await (holder ??= bitmapHolderNow(data.height));
      if (h.status === "unavailable") { out[i.pubkey] = unavailable(h.reason); continue; }
      out[i.pubkey] = h.status === "ok" && h.holder === i.address
        ? { ok: true, status: "verified", address: i.address, role: "landowner", checkedAt: Date.now() }
        : reject("address no longer holds this BITMAP");
    }
    return out;
  });
