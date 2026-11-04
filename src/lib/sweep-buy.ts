/**
 * One sweep purchase with injectable wallet/server steps so the flow can be
 * tested with mocked signing and broadcast. Failure classes:
 *  - before signing / wallet rejection → safe skip, hold released
 *  - after a signed PSBT was handed to submit and the result is unknown →
 *    AmbiguousBroadcastError: hold is NOT released and the runner halts.
 */
import type { CartItem } from "@/lib/sweep-cart";

export class AmbiguousBroadcastError extends Error {
  constructor(public spentSats: number, cause: string) {
    super(`BROADCAST UNCERTAIN · ${cause} · CHECK WALLET BEFORE RESUMING`);
    this.name = "AmbiguousBroadcastError";
  }
}

export type Quote = { psbtBase64: string; signIndices: number[]; priceSats: number; marketFeeSats: number; feeSats: number };
export type SweepBuySteps = {
  quote: (item: CartItem) => Promise<Quote>;
  sign: (q: Quote) => Promise<string>;
  submit: (item: CartItem, signed: string) => Promise<{ txid?: string | null }>;
  release: (item: CartItem) => Promise<unknown>;
  onBought?: (item: CartItem, txid: string) => void;
};

export function makeBuyOne(s: SweepBuySteps) {
  return async (item: CartItem): Promise<{ txid: string | null; spentSats: number }> => {
    const q = await s.quote(item);
    const cost = q.priceSats + q.marketFeeSats + q.feeSats;
    let signed: string;
    try {
      signed = await s.sign(q);
    } catch (e) {
      void s.release(item).catch(() => {});
      throw new Error(`WALLET DECLINED · ${(e as Error)?.message ?? "REJECTED"}`);
    }
    let res: { txid?: string | null };
    try {
      res = await s.submit(item, signed);
    } catch (e) {
      throw new AmbiguousBroadcastError(cost, (e as Error)?.message ?? "NO RESPONSE");
    }
    if (!res?.txid) throw new AmbiguousBroadcastError(cost, "NO TXID RETURNED");
    s.onBought?.(item, res.txid);
    return { txid: res.txid, spentSats: cost };
  };
}
