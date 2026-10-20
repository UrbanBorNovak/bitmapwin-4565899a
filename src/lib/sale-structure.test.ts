import { describe, expect, it } from "vitest";
import { salePriceOf } from "./sale-structure";

const S = "bc1pseller", B = "bc1pbuyer";
const io = (a: string, v = 1000) => ({ prevout: { value: v, scriptpubkey_address: a } });
const out = (a: string, v: number) => ({ value: v, scriptpubkey_address: a });

describe("salePriceOf", () => {
  it("1-input sweep with change back to sender is never a sale", () => {
    const tx = { vin: [io(S, 4_712_000_000)], vout: [out("339e", 3_500_000_000), out(S, 1_182_267_446)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
  it("marketplace layout pays the paired seller output", () => {
    const tx = { vin: [io(B, 600), io(S, 546), io(B, 200_000)], vout: [out(B, 600), out(S, 150_000), out(B, 546), out(B, 40_000)] };
    expect(salePriceOf(tx, 1, 2, S)).toBe(150_000);
  });
  it("no buyer funding input means no price", () => {
    const tx = { vin: [io(S, 546), io(S, 9000)], vout: [out(B, 546), out(S, 8000)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
  it("payout at a non-paired index is not a price", () => {
    const tx = { vin: [io(S, 546), io(B, 9000)], vout: [out(B, 546), out(S, 8000)] };
    expect(salePriceOf(tx, 0, 0, S)).toBe(0);
  });
});
