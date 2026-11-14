import { createServerFn } from "@tanstack/react-start";

type Item = { pubkey: string; address: string; signature: string; issuedAt: number; kind?: "land" | "parcel" };
export type RoomOwnerCheck = { ok: boolean; reason?: string; address?: string; role?: "landowner" | "parcel"; parcels?: number[] };

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
  .handler(async ({ data }): Promise<{ role: "landowner" | "parcel" | null; parcels: number[] }> => {
    const { bitmapHolderNow, liveParcelsHeldBy } = await import("@/lib/nostr/bitchat-landowner.server");
    try {
      if ((await bitmapHolderNow(data.height)) === data.address) return { role: "landowner", parcels: [] };
    } catch (e) { console.error("roomRoleFn holder", e); }
    try {
      const parcels = await liveParcelsHeldBy(data.height, data.address);
      if (parcels.length) return { role: "parcel", parcels };
    } catch (e) { console.error("roomRoleFn parcels", e); }
    return { role: null, parcels: [] };
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
    let holder: Promise<string | null> | undefined;
    const holderNow = () => (holder ??= bitmapHolderNow(data.height).catch((e) => { console.error("verifyRoomOwnersFn holder", e); return null; }));
    const parcelsBy = new Map<string, Promise<number[] | null>>();
    const parcelsNow = (a: string) => {
      if (!parcelsBy.has(a)) parcelsBy.set(a, liveParcelsHeldBy(data.height, a).catch((e) => { console.error("verifyRoomOwnersFn parcels", e); return null; }));
      return parcelsBy.get(a)!;
    };
    const out: Record<string, RoomOwnerCheck> = {};
    for (const i of data.items) {
      if (!proofFresh(i.issuedAt, now)) { out[i.pubkey] = { ok: false, reason: "proof expired" }; continue; }
      let valid = false;
      try { valid = Verifier.verifySignature(i.address, roomProofMessage(i.kind, data.height, i.address, i.pubkey, i.issuedAt), i.signature); } catch { valid = false; }
      if (!valid) { out[i.pubkey] = { ok: false, reason: "signature does not verify" }; continue; }
      if (i.kind === "parcel") {
        const held = await parcelsNow(i.address);
        if (held === null) { out[i.pubkey] = { ok: false, reason: "parcel lookup unavailable" }; continue; }
        out[i.pubkey] = held.length
          ? { ok: true, address: i.address, role: "parcel", parcels: held }
          : { ok: false, reason: "address holds no valid parcel of this BITMAP right now" };
        continue;
      }
      const h = await holderNow();
      if (!h) { out[i.pubkey] = { ok: false, reason: "holder lookup unavailable" }; continue; }
      out[i.pubkey] = h === i.address ? { ok: true, address: i.address, role: "landowner" } : { ok: false, reason: "address no longer holds this BITMAP" };
    }
    return out;
  });
