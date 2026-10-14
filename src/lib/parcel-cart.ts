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

export type CartEstimate = { count: number; vbytes: number; feeSats: number; postageSats: number; totalSats: number };

export function estimateCart(indexes: number[], height: number, feeRate: number): CartEstimate {
  const rate = Math.max(1, feeRate);
  const vbytes = indexes.reduce((s, i) => s + parcelVbytes(i, height), 0);
  const feeSats = Math.ceil(vbytes * rate);
  const postageSats = indexes.length * PARCEL_POSTAGE;
  return { count: indexes.length, vbytes, feeSats, postageSats, totalSats: feeSats + postageSats };
}

/** Toggle an index in the cart, keeping order and the size cap. */
export function toggleCart(cart: number[], index: number): number[] {
  if (cart.includes(index)) return cart.filter((i) => i !== index);
  if (cart.length >= PARCEL_CART_MAX) return cart;
  return [...cart, index];
}
