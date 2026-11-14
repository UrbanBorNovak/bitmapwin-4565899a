import { createServerFn } from "@tanstack/react-start";

type Item = { pubkey: string; address: string; signature: string; issuedAt: number };

/** Public, stores nothing: checks BIP-322 delegation + that the address holds the canonical BITMAP right now. */
export const verifyRoomOwnersFn = createServerFn({ method: "POST" })
  .inputValidator((d: { height: number; items: Item[] }) => {
    const h = Number(d?.height);
    if (!Number.isInteger(h) || h < 0 || h > 2_000_000) throw new Error("bad height");
    const items = (Array.isArray(d?.items) ? d.items : []).slice(0, 20).filter((i) =>
      /^[0-9a-f]{64}$/.test(String(i?.pubkey)) && typeof i?.address === "string" && i.address.length < 100
      && typeof i?.signature === "string" && i.signature.length < 400 && Number.isInteger(i?.issuedAt));
    return { height: h, items };
  })
  .handler(async ({ data }) => {
    const { landownerMessage, proofFresh } = await import("@/lib/nostr/bitchat-landowner");
    const { Verifier } = await import("bip322-js");
    const now = Math.floor(Date.now() / 1000);
    let holder: string | null | undefined;
    const holderNow = async () => {
      if (holder !== undefined) return holder;
      holder = null;
      try {
        const { liveBitmapFn } = await import("@/lib/bw-matter.functions");
        const d = await liveBitmapFn({ data: { height: data.height } });
        if (d.inscriptionId) {
          const { ordInscription } = await import("@/lib/ord-fallback.server");
          holder = (await ordInscription(d.inscriptionId))?.address ?? null;
        }
      } catch (e) { console.error("verifyRoomOwnersFn holder", e); }
      return holder;
    };
    const out: Record<string, { ok: boolean; reason?: string; address?: string }> = {};
    for (const i of data.items) {
      if (!proofFresh(i.issuedAt, now)) { out[i.pubkey] = { ok: false, reason: "proof expired" }; continue; }
      let valid = false;
      try { valid = Verifier.verifySignature(i.address, landownerMessage(data.height, i.address, i.pubkey, i.issuedAt), i.signature); } catch { valid = false; }
      if (!valid) { out[i.pubkey] = { ok: false, reason: "signature does not verify" }; continue; }
      const h = await holderNow();
      if (!h) { out[i.pubkey] = { ok: false, reason: "holder lookup unavailable" }; continue; }
      out[i.pubkey] = h === i.address ? { ok: true, address: i.address } : { ok: false, reason: "address no longer holds this BITMAP" };
    }
    return out;
  });
