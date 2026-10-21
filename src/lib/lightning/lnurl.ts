/**
 * Browser-side Lightning tipping (no BITMAPWIN node, no custody).
 * Lightning Address (LUD-16) → LNURL-pay (LUD-06) → BOLT11 invoice, then pay
 * with WebLN, NWC (NIP-47) or any phone wallet via QR.
 */
export const TIP_PRESETS = [21, 100, 500, 2100] as const;

export function lnAddressUrl(address: string): string | null {
  const m = /^([a-z0-9._+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(address.trim());
  if (!m) return null;
  return `https://${m[2]!.toLowerCase()}/.well-known/lnurlp/${m[1]!.toLowerCase()}`;
}

type PayParams = { callback: string; minSendable: number; maxSendable: number; commentAllowed?: number; tag?: string; status?: string; reason?: string };

/** Clamps a tip to the receiver's limits; returns null when it cannot be sent. */
export function tipMsat(sats: number, p: Pick<PayParams, "minSendable" | "maxSendable">): number | null {
  if (!Number.isFinite(sats) || sats < 1) return null;
  const msat = Math.round(sats) * 1000;
  return msat >= p.minSendable && msat <= p.maxSendable ? msat : null;
}

export async function fetchInvoice(address: string, sats: number, comment: string): Promise<string> {
  const url = lnAddressUrl(address);
  if (!url) throw new Error("NOT A LIGHTNING ADDRESS");
  const p = (await (await fetch(url)).json()) as PayParams;
  if (p.status === "ERROR" || p.tag !== "payRequest") throw new Error(p.reason || "RECEIVER WALLET REFUSED");
  const msat = tipMsat(sats, p);
  if (!msat) throw new Error(`AMOUNT MUST BE ${Math.ceil(p.minSendable / 1000)}–${Math.floor(p.maxSendable / 1000)} SATS`);
  const cb = new URL(p.callback);
  cb.searchParams.set("amount", String(msat));
  if (comment && (p.commentAllowed ?? 0) > 0) cb.searchParams.set("comment", comment.slice(0, p.commentAllowed));
  const r = (await (await fetch(cb.toString())).json()) as { pr?: string; status?: string; reason?: string };
  if (!r.pr) throw new Error(r.reason || "NO INVOICE RETURNED");
  return r.pr;
}

type WebLN = { enable(): Promise<void>; sendPayment(pr: string): Promise<{ preimage: string }> };
export const webln = (): WebLN | null => (typeof window === "undefined" ? null : ((window as unknown as { webln?: WebLN }).webln ?? null));

export async function payWithWebln(pr: string): Promise<string> {
  const w = webln();
  if (!w) throw new Error("NO WEBLN WALLET");
  await w.enable();
  return (await w.sendPayment(pr)).preimage;
}

const NWC_KEY = "bitmapwin:nwc";
export const savedNwc = () => (typeof window === "undefined" ? "" : localStorage.getItem(NWC_KEY) ?? "");
export const saveNwc = (s: string) => (s ? localStorage.setItem(NWC_KEY, s.trim()) : localStorage.removeItem(NWC_KEY));

/** Pays through the visitor's own Nostr Wallet Connect string; it never leaves this device except as the encrypted request. */
export async function payWithNwc(conn: string, pr: string): Promise<string> {
  const { parseConnectionString, makeNwcRequestEvent } = await import("nostr-tools/nip47");
  const { SimplePool } = await import("nostr-tools/pool");
  const { decrypt } = await import("nostr-tools/nip04");
  const { hexToBytes } = await import("@noble/hashes/utils.js");
  const c = parseConnectionString(conn);
  const ev = await makeNwcRequestEvent(c.pubkey, hexToBytes(c.secret), pr);
  const pool = new SimplePool();
  try {
    return await new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => { sub.close(); reject(new Error("WALLET DID NOT ANSWER")); }, 30_000);
      const sub = pool.subscribeMany([c.relay], { kinds: [23195], authors: [c.pubkey], "#e": [ev.id] }, {
        onevent: async (e) => {
          clearTimeout(t); sub.close();
          try {
            const res = JSON.parse(await decrypt(c.secret, c.pubkey, e.content)) as { error?: { message?: string }; result?: { preimage?: string } };
            res.result?.preimage ? resolve(res.result.preimage) : reject(new Error(res.error?.message || "PAYMENT FAILED"));
          } catch { reject(new Error("BAD WALLET REPLY")); }
        },
      });
      void Promise.any(pool.publish([c.relay], ev)).catch(() => { clearTimeout(t); sub.close(); reject(new Error("RELAY UNREACHABLE")); });
    });
  } finally { pool.close([c.relay]); }
}
