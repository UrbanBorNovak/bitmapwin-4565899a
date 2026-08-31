/**
 * Marketplace fee policy.
 *
 * A flat, industry-standard percentage of the sale price is paid by the buyer
 * to the marketplace address as an extra output on the purchase transaction.
 * The seller's SIGHASH_SINGLE|ANYONECANPAY signature only commits to output 0
 * (their payment), so appending the fee output does not invalidate the offer.
 */

export const MARKETPLACE_FEE_ADDRESS = "bc1qmp0x47twrjududsj9txvdkvv9kmcl6r8u3eteq";

/** 200 basis points = 2% of the sale price. */
export const MARKETPLACE_FEE_BPS = 200;

export const MARKETPLACE_FEE_PERCENT = MARKETPLACE_FEE_BPS / 100;

const DUST = 546;

/** Fee in sats for a given price, rounded up and lifted above the dust limit. */
export function marketplaceFeeSats(priceSats: number): number {
  if (!Number.isFinite(priceSats) || priceSats <= 0) return 0;
  const raw = Math.ceil((priceSats * MARKETPLACE_FEE_BPS) / 10_000);
  return Math.max(DUST, raw);
}
