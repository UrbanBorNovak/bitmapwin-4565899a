import { describe, expect, it } from "vitest";
import { conventionTier, parseStandConfig, qualifyingBitmap, standMessage } from "./sovereign-stand";
import { seatMessage } from "./launch-seats";

describe("BW-STAND-1", () => {
  it("only accepts BW-STAND-1 configs", () => {
    expect(parseStandConfig({ p: "BW-STAND-1", name: "X" })?.name).toBe("X");
    expect(parseStandConfig({ p: "brc-20", name: "X" })).toBeNull();
  });
  it("needs a held BITMAP inside the stand's range", () => {
    const c = parseStandConfig({ p: "BW-STAND-1", name: "X", bitmap: { min: 100, max: 200 } })!;
    expect(qualifyingBitmap(c, [50, 150])).toBe(150);
    expect(qualifyingBitmap(c, [50, 250])).toBeNull();
    expect(qualifyingBitmap(c, [])).toBeNull();
  });
  it("seat signatures are bound to one stand", () => {
    expect(standMessage("a", "bc1q", "t")).not.toBe(standMessage("b", "bc1q", "t"));
    expect(standMessage("a", "bc1q", "t")).not.toBe(seatMessage("bc1q", "t"));
  });
  it("Convention Badge tiers at 3, 5 and 10 stands", () => {
    expect(conventionTier(2)).toBeNull();
    expect(conventionTier(3)?.name).toBe("DELEGATE");
    expect(conventionTier(5)?.name).toBe("CIRCUIT REGULAR");
    expect(conventionTier(10)?.name).toBe("CONVENTION LEGEND");
  });
});
