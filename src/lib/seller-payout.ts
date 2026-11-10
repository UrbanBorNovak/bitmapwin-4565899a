import { decodePsbt } from "@/lib/psbt";

/**
 * The price output the seller's SIGHASH_SINGLE|ANYONECANPAY signature commits
 * to — output 0 of the stored listing PSBT. This, not the BITMAP holder
 * address, is where the money must go (Xverse-style wallets pay a separate
 * bc1q payment address). Returns null when the PSBT cannot be decoded.
 */
export function signedSellerPayout(
  sellerPsbtBase64: string | null | undefined,
): { scriptHex: string; address: string | null; valueSats: number } | null {
  if (!sellerPsbtBase64) return null;
  try {
    const out = decodePsbt(sellerPsbtBase64).outputs[0];
    if (!out) return null;
    return { scriptHex: out.scriptPubKeyHex.toLowerCase(), address: out.address, valueSats: out.valueSats };
  } catch {
    return null;
  }
}

/** True when a transaction output pays the seller's signed payout at least the asking price. */
export function paysSignedSeller(
  payout: { scriptHex: string; valueSats: number } | null,
  out: { scriptHex?: string | null; valueSats?: number | null } | undefined,
  priceSats: number,
): boolean {
  if (!payout || !out?.scriptHex) return false;
  const value = Number(out.valueSats ?? 0);
  return out.scriptHex.toLowerCase() === payout.scriptHex && value >= priceSats && value >= payout.valueSats;
}
