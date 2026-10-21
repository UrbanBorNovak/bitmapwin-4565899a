/**
 * Relic mint payout guard — pure, fail-closed.
 * A relic reveal may only be signed when: the block is mined, both parents
 * (matching <height>.bitmap + verified collection) are included, the current
 * BITMAP holder was verified live on chain, and the treasury address is valid.
 * The tier tribute is then split 50/50 as two extra reveal outputs.
 */
import * as btc from "@scure/btc-signer";
import { checkMintParents, type ParentCheckInput } from "@/lib/mint-parents-guard";
import { relicTribute, withinTip } from "@/lib/marauder-relics";

export const RELIC_DUST = 546;
export type RelicPayout = { address: string; sats: number; role: "HOLDER" | "TREASURY" };
export type RelicMissing = "TIP" | "BITMAP" | "COLLECTION" | "HOLDER" | "TREASURY";

export function validAddress(a: string | null | undefined): a is string {
  if (!a) return false;
  try { btc.Address(btc.NETWORK).decode(a); return true; } catch { return false; }
}

export type RelicPlanInput = ParentCheckInput & {
  height: number;
  tip: number | null;
  /** live holder of the BITMAP parent, from chain; null = unverified */
  holderAddress: string | null;
  treasuryAddress: string | null;
};

export function planRelicMint(i: RelicPlanInput):
  | { ok: true; payouts: RelicPayout[]; total: number }
  | { ok: false; missing: RelicMissing[]; message: string } {
  const missing: RelicMissing[] = [];
  if (!withinTip(i.height, i.tip)) missing.push("TIP");
  const p = checkMintParents(i);
  if (!p.ok) missing.push(...p.missing);
  // Holder must be the address that actually holds the BITMAP parent being spent.
  const bm = i.bitmapParentId?.toLowerCase();
  const spend = i.parents.find((x) => x.inscriptionId.toLowerCase() === bm) as { address?: string } | undefined;
  if (!validAddress(i.holderAddress) || (spend?.address && spend.address !== i.holderAddress)) missing.push("HOLDER");
  if (!validAddress(i.treasuryAddress)) missing.push("TREASURY");
  if (missing.length) {
    const label: Record<RelicMissing, string> = {
      TIP: "A MINED BLOCK HEIGHT", BITMAP: "THE MATCHING BITMAP PARENT", COLLECTION: "THE VERIFIED COLLECTION PARENT",
      HOLDER: "THE VERIFIED BITMAP HOLDER", TREASURY: "THE TREASURY ADDRESS",
    };
    return { ok: false, missing, message: `SIGNING BLOCKED — COULD NOT VERIFY ${missing.map((m) => label[m]).join(", ")}. NOTHING WAS SIGNED OR PAID.` };
  }
  const t = relicTribute(i.height);
  const payouts: RelicPayout[] = [
    { address: i.holderAddress!, sats: Math.max(RELIC_DUST, t.holder), role: "HOLDER" },
    { address: i.treasuryAddress!, sats: Math.max(RELIC_DUST, t.treasury), role: "TREASURY" },
  ];
  return { ok: true, payouts, total: payouts.reduce((s, x) => s + x.sats, 0) };
}

/** Before signing: the prepared transaction must pay every planned payout in full. */
export function revealPaysPlan(tx: btc.Transaction, payouts: RelicPayout[]): { ok: true } | { ok: false; reason: string } {
  const paid = new Map<string, bigint>();
  for (let i = 0; i < tx.outputsLength; i++) {
    const o = tx.getOutput(i);
    if (!o.script) continue;
    const k = btc.utils ? Buffer.from(o.script).toString("hex") : "";
    paid.set(k, (paid.get(k) ?? 0n) + (o.amount ?? 0n));
  }
  for (const p of payouts) {
    const k = Buffer.from(btc.OutScript.encode(btc.Address(btc.NETWORK).decode(p.address))).toString("hex");
    if ((paid.get(k) ?? 0n) < BigInt(p.sats)) return { ok: false, reason: `TRANSACTION DOES NOT PAY ${p.role} ${p.sats} SATS` };
  }
  return { ok: true };
}
