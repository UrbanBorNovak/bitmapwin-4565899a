import { describe, expect, it } from "vitest";
import { deriveMatter } from "@/lib/bw-matter";
import { dmtBlueprint } from "@/lib/bw-matter-blueprint";

const bp = (height: number, txCount: number, weight: number, nonce = 0) => {
  const b = { height, txCount, size: weight / 4, weight, nonce };
  return dmtBlueprint(b, deriveMatter(b));
};

describe("DMT blueprint", () => {
  it("under 50 transactions is a solitary monolith", () => expect(bp(0, 1, 1000).footprint).toBe("SOLITARY MONOLITH"));
  it("over 1,500 transactions is a terraced ziggurat", () => expect(bp(800_000, 3000, 4_000_000).footprint).toBe("TERRACED ZIGGURAT"));
  it("ceiling caps at 60 voxels", () => expect(bp(800_000, 3000, 4_000_000).ceiling).toBe(58));
  it("era follows the halving", () => expect(bp(420_000, 100, 400_000).tradition.name).toBe("REFRACTORY"));
});
