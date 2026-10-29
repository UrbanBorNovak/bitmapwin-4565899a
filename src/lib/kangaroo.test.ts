import { describe, it, expect } from "vitest";
import { solver, practiceTarget, pointFromHex, cryptoRand } from "./kangaroo";

describe("kangaroo", () => {
  it("recovers a 24-bit key from its public key", () => {
    const t = practiceTarget(24);
    const s = solver(pointFromHex(t.pubHex), t.lo, t.hi, 8, cryptoRand);
    let k: bigint | null = null;
    for (let i = 0; i < 2000 && k === null; i++) k = s.step(16);
    expect(k).toBe(t.k);
  }, 60000);
});
