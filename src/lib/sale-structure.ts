/**
 * Decides whether an inscription transfer is a real marketplace sale.
 * Ordinal marketplaces (Magic Eden, Ordswap, BitmapWin) sign the seller's
 * inscription input with SIGHASH_SINGLE|ANYONECANPAY, so the seller payout is
 * the output at the same index as the inscription input, and the buyer adds
 * their own funding input(s). Anything else (sweeps, change, self-sends) is a
 * transfer with price 0.
 */
export type SaleTx = {
  vin: Array<{ prevout?: { value: number; scriptpubkey_address?: string | null } | null }>;
  vout: Array<{ value: number; scriptpubkey_address?: string | null }>;
};

export function salePriceOf(tx: SaleTx, inscriptionVin: number, inscriptionVout: number, seller: string | null): number {
  if (!seller) return 0;
  // Change exclusion: a 1-input tx has no buyer funding, so no payout is a price.
  if (tx.vin.length < 2) return 0;
  if (tx.vin[inscriptionVin]?.prevout?.scriptpubkey_address !== seller) return 0;
  // Buyer funding input: at least one input must come from someone else.
  const buyerFunded = tx.vin.some((v, i) => i !== inscriptionVin && v.prevout?.scriptpubkey_address && v.prevout.scriptpubkey_address !== seller);
  if (!buyerFunded) return 0;
  // Postage: the inscription must land with a different address.
  const buyer = tx.vout[inscriptionVout]?.scriptpubkey_address ?? null;
  if (!buyer || buyer === seller) return 0;
  // Exact seller payout at the paired index.
  if (inscriptionVin === inscriptionVout) return 0;
  const payout = tx.vout[inscriptionVin];
  if (!payout || payout.scriptpubkey_address !== seller || payout.value <= 0) return 0;
  return payout.value;
}
