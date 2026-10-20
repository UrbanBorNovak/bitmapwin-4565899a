import { describe, expect, it } from "vitest";
import { salePriceOf } from "./sale-structure";

const S = "bc1pseller", B = "bc1pbuyer", X = "bc1pother";
const io = (a: string, v = 1000) => ({ prevout: { value: v, scriptpubkey_address: a } });
const out = (a: string, v: number) => ({ value: v, scriptpubkey_address: a });

describe("salePriceOf", () => {
  it("1-input sweep with change back to sender is never a sale (1138.bitmap)", () => {
    const tx = { vin: [io(S, 4_712_267_485)], vout: [out(X, 348_000), out(B, 3_500_000_000), out(S, 1_182_267_446)] };
    expect(salePriceOf(tx, 0, 1, S)).toBe(0);
  });
  it("Magic Eden layout: dummies, inscription, payment → payout after postage (191.bitmap)", () => {
    const tx = { vin: [io(B, 300), io(B, 300), io(S, 546), io(B, 1_684_000), io(B, 600)], vout: [out(B, 600), out(B, 546), out(S, 1_500_000), out(X, 7500), out(B, 174_755)] };
    expect(salePriceOf(tx, 2, 1, S)).toBe(1_500_000);
  });
  it("2-in/2-out swap: postage first, payout second (5201.bitmap)", () => {
    const tx = { vin: [io(S, 546), io(B, 190_967)], vout: [out(B, 546), out(S, 190_546)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(190_546);
  });
  it("swap with extra fee and buyer change outputs (1235.bitmap)", () => {
    const tx = { vin: [io(S, 549), io(B, 6_991_437)], vout: [out(B, 549), out(S, 195_549), out(X, 5000), out(B, 6_790_603)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(195_549);
  });
  it("seller funding their own payout (consolidation/coinjoin) is not a sale", () => {
    const tx = { vin: [io(S, 546), io(S, 452_855), io(X, 278_074)], vout: [out(B, 3_174_355), out(S, 345_743)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
  it("no buyer funding input means no price", () => {
    const tx = { vin: [io(S, 546), io(S, 9000)], vout: [out(B, 546), out(S, 8000)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
  it("self-send to the same address is not a sale", () => {
    const tx = { vin: [io(S, 10_011), io(X, 2694)], vout: [out(S, 10_011), out(S, 546)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
});
