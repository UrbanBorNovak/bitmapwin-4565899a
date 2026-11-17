import { describe, it, expect } from "vitest";
import { splitFee } from "./fee-recycling";
describe("splitFee", () => {
  it("splits a 2,100 sat skin 50/30/20", () => expect(splitFee(2100)).toEqual({ pool: 1050, reserve: 630, runway: 420 }));
  it("gives rounding remainder to the pool", () => expect(splitFee(1)).toEqual({ pool: 1, reserve: 0, runway: 0 }));
});
