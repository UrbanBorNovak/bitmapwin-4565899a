import { describe, expect, it } from "vitest";
import { estimateCart, PARCEL_CART_MAX, toggleCart } from "./parcel-cart";

describe("parcel cart", () => {
  it("adds postage of 546 sats per parcel", () => {
    expect(estimateCart([1, 2, 3], 560770, 1).postageSats).toBe(1638);
  });
  it("scales fee with the fee rate", () => {
    const a = estimateCart([1, 2], 560770, 1), b = estimateCart([1, 2], 560770, 3);
    expect(b.feeSats).toBe(Math.ceil(a.vbytes * 3));
    expect(b.totalSats).toBe(b.feeSats + 1092);
  });
  it("never goes below 1 sat/vB", () => {
    expect(estimateCart([5], 1, 0).feeSats).toBe(estimateCart([5], 1, 1).feeSats);
  });
  it("toggles and caps the cart", () => {
    expect(toggleCart([1, 2], 2)).toEqual([1]);
    const full = Array.from({ length: PARCEL_CART_MAX }, (_, i) => i);
    expect(toggleCart(full, 999)).toHaveLength(PARCEL_CART_MAX);
  });
});
