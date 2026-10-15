import { describe, expect, it } from "vitest";
import { kennelSupply, validKennelPrice } from "./kennel";

describe("kennel rules", () => {
  it("caps supply at the block's transaction count", () => {
    expect(kennelSupply(935)).toBe(935);
  });
  it("rejects prices outside 1,000–1,000,000 sats", () => {
    expect(validKennelPrice(999)).toBe(false);
    expect(validKennelPrice(1_000)).toBe(true);
    expect(validKennelPrice(1_000_001)).toBe(false);
  });
});
