import { describe, it, expect } from "vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { hash160At, matchNibbles } from "./puzzle-hash160";
import { makeWalker, BATCH } from "./puzzle-batch";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

describe("zero-alloc hash160", () => {
  it("matches noble for every key across batches", () => {
    const w = makeWalker(0x5a1234567890abcdefn);
    for (let b = 0; b < 4; b++) {
      w.next(BATCH);
      for (let i = 0; i < BATCH; i++) {
        const ref = ripemd160(sha256(w.pubs.subarray(i * 33, i * 33 + 33)));
        expect(hex(hash160At(w.pubs, i * 33))).toBe(hex(ref));
      }
    }
  });
  it("counts matching hex characters like the string compare", () => {
    const t = Uint8Array.from(Buffer.from("f6f5431d25bbf7b12e8add9af5e3475c44a0a5b8", "hex"));
    for (let r = 0; r < 2000; r++) {
      const h = t.slice();
      const cut = r % 41;
      if (cut < 40) { const j = cut >> 1; h[j] = h[j]! ^ (cut & 1 ? 0x01 : 0x10); }
      const a = hex(h), b = hex(t);
      let n = 0; while (n < 40 && a[n] === b[n]) n++;
      expect(matchNibbles(h, t)).toBe(n);
    }
  });
});
