import { describe, expect, it } from "vitest";
import { cartTotal, mergeCart } from "./sweep-cart";

const it1 = (id: string, p: number) => ({ offerId: id, height: 1, priceSats: p, inscriptionId: "x" });

describe("sweep cart", () => {
  it("never queues the same ask twice", () => {
    expect(mergeCart([it1("a", 1)], [it1("a", 1), it1("b", 2)]).map((i) => i.offerId)).toEqual(["a", "b"]);
  });
  it("caps the basket", () => {
    expect(mergeCart([], [it1("a", 1), it1("b", 1), it1("c", 1)], 2)).toHaveLength(2);
  });
  it("totals ask prices", () => {
    expect(cartTotal([it1("a", 1000), it1("b", 2500)])).toBe(3500);
  });
});
