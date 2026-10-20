/**
 * Decides whether an inscription transfer is a real marketplace sale.
 * Ordinal swaps (Magic Eden, Ordswap, BitmapWin, OKX…) all share one shape:
 * the seller's inscription input plus buyer-funded inputs, the inscription
 * landing at a new address, and a seller payout funded by the buyer. Payout
 * position varies between marketplaces, so the price is the seller's NET gain
 * (seller outputs minus the seller's own non-inscription inputs), capped by
 * what other parties put in. Sweeps, change and self-sends price at 0.
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
  const buyer = tx.vout[inscriptionVout]?.scriptpubkey_address ?? null;
  if (!buyer || buyer === seller) return 0;

  let sellerIn = 0;
  let otherIn = 0;
  tx.vin.forEach((v, i) => {
    if (i === inscriptionVin) return;
    const addr = v.prevout?.scriptpubkey_address;
    if (!addr || !v.prevout) return;
    if (addr === seller) sellerIn += v.prevout.value;
    else otherIn += v.prevout.value;
  });
  // Buyer funding input required.
  if (otherIn <= 0) return 0;

  let sellerOut = 0;
  tx.vout.forEach((o, i) => {
    if (i !== inscriptionVout && o.scriptpubkey_address === seller) sellerOut += o.value;
  });
  const net = sellerOut - sellerIn;
  // The payout must be new money from someone else, not the seller's own change.
  if (net <= 0 || net > otherIn) return 0;
  return net;
}
