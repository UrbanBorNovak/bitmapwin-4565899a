import { describe, expect, it } from "vitest";
import { mathTraits, satReading } from "./slab-rarity";

const ids = (h: number, hash?: string, sat?: number) => mathTraits(h, hash, sat).map((t) => t.id);

describe("slab rarity", () => {
  it("715093 is not prime (23 × 31091) and has no math traits", () => {
    expect(ids(715093)).toEqual([]);
  });
  it("detects palindrome, repdigit, prime, square, round", () => {
    expect(ids(777777)).toEqual(expect.arrayContaining(["palindrome", "repdigit"]));
    expect(ids(7919)).toContain("prime");
    expect(ids(1024)).toEqual(expect.arrayContaining(["square", "power-2"]));
    expect(ids(700000)).toContain("round");
    expect(ids(100000)).toContain("power-10");
  });
  it("dual palindrome needs a palindrome sat", () => {
    expect(ids(12321, undefined, 1234321)).toContain("dual-palindrome");
    expect(ids(12321, undefined, 1234)).not.toContain("dual-palindrome");
  });
  it("sat 715093.bitmap sits on a common sat mined in block 302,673", () => {
    const r = satReading(1281682543628173);
    expect(r.rarity).toBe("COMMON");
    expect(r.minedIn).toBe(302673);
  });
  it("first sat of a block is uncommon", () => {
    expect(satReading(50 * 1e8).rarity).toBe("UNCOMMON");
  });
});
