import { describe, it, expect } from "vitest";
import { G, pointFromHex } from "./kangaroo";
import { isDp, jumpSet, keyFromCollision, poolParams, pointFor, startsFor, validDp } from "./kangaroo-pool";

const k = 0x9abcdefn; // 28-bit
const pub = G.multiply(k).toHex(true);
const { lo, hi, jumps, dpBits } = poolParams(28);

describe("speed bounty pool", () => {
  it("gives different hunters different starts", () => {
    const a = startsFor("seed", 0, 16, lo, hi), b = startsFor("seed", 1, 16, lo, hi);
    expect(a[0]!.d).not.toBe(b[0]!.d);
    expect(startsFor("seed", 0, 16, lo, hi)[3]!.d).toBe(a[3]!.d);
  });

  it("rejects a forged distinguished point", () => {
    expect(validDp(pub, { xHex: "1".padEnd(64, "0"), tame: true, dHex: (lo + 5n).toString(16) }, dpBits, lo, hi)).toBe(false);
  });

  it("rejects a collision that does not open the key", () => {
    expect(keyFromCollision(pub, lo + 100n, 3n)).toBeNull();
  });

  it("two server-assigned hunters jointly recover the key", () => {
    const P = pointFromHex(pub);
    const { dist, pts } = jumpSet(jumps);
    const herd = [0, 1].flatMap((seq) => startsFor("s", seq, 16, lo, hi)).map((s) => ({ ...s, pt: pointFor(P, s.tame, s.d) }));
    const table = new Map<string, { tame: boolean; d: bigint }>();
    let found: bigint | null = null;
    for (let i = 0; i < 20000 && found === null; i++) for (const h of herd) {
      const x = h.pt.toAffine().x;
      if (isDp(x, dpBits)) {
        const dp = { xHex: x.toString(16), tame: h.tame, dHex: h.d.toString(16) };
        expect(validDp(pub, dp, dpBits, lo, hi)).toBe(true);
        const o = table.get(dp.xHex);
        if (o && o.tame !== h.tame) found = keyFromCollision(pub, h.tame ? h.d : o.d, h.tame ? o.d : h.d);
        if (found !== null) break;
        table.set(dp.xHex, { tame: h.tame, d: h.d });
      }
      const j = Number(x % BigInt(jumps));
      h.pt = h.pt.add(pts[j]!); h.d += dist[j]!;
    }
    expect(found).toBe(k);
  }, 120000);
});
