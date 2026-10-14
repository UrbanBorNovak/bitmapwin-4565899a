/** Parcel Studio cart maths. Pure + browser-safe. Fee figures are estimates; the inscriber prices each job exactly. */
import { parcelName } from "@/lib/parcels";

export const PARCEL_CART_MAX = 20;
/** Postage kept on the inscribed sat (returns to the buyer, still leaves the wallet). */
export const PARCEL_POSTAGE = 546;
const COMMIT_VB = 154;
/** Reveal with one parent input + parent return output, before the claim text. */
const REVEAL_BASE_VB = 210;

export function parcelVbytes(index: number, height: number): number {
  return COMMIT_VB + REVEAL_BASE_VB + Math.ceil(parcelName(index, height).length / 4);
}

/** Site fee charged once per creation session, whether one parcel or many. Paid inside the first reveal. */
export const PARCEL_SITE_FEE = 546;
/** Extra reveal output for the site fee. */
const SITE_FEE_VB = 43;

export type CartEstimate = { count: number; vbytes: number; feeSats: number; postageSats: number; siteFeeSats: number; totalSats: number };

export function estimateCart(indexes: number[], height: number, feeRate: number, includeSiteFee = true): CartEstimate {
  const rate = Math.max(1, feeRate);
  const charge = includeSiteFee && indexes.length > 0;
  const vbytes = indexes.reduce((s, i) => s + parcelVbytes(i, height), 0) + (charge ? SITE_FEE_VB : 0);
  const feeSats = Math.ceil(vbytes * rate);
  const postageSats = indexes.length * PARCEL_POSTAGE;
  const siteFeeSats = charge ? PARCEL_SITE_FEE : 0;
  return { count: indexes.length, vbytes, feeSats, postageSats, siteFeeSats, totalSats: feeSats + postageSats + siteFeeSats };
}

/** Toggle an index in the cart, keeping order and the size cap. */
export function toggleCart(cart: number[], index: number): number[] {
  if (cart.includes(index)) return cart.filter((i) => i !== index);
  if (cart.length >= PARCEL_CART_MAX) return cart;
  return [...cart, index];
}
