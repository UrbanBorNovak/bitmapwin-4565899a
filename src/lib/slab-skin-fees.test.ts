import { describe, expect, it } from "vitest";
import { slabSkin } from "@/lib/slab-skins";
import { certFacts } from "@/lib/slab-cert";

const g = { grade: 9, name: "MINT", subs: [], cert: "X" } as never;
describe("slab skin fees", () => {
  it("prices match the catalog", () => {
    expect([slabSkin("gold").priceSats, slabSkin("holo").priceSats, slabSkin("obsidian").priceSats, slabSkin("biome").priceSats, slabSkin("acrylic").priceSats]).toEqual([1500, 2100, 3300, 2500, 0]);
  });
  it("paid skin is written into the inscribed facts", () => {
    expect(certFacts(715093, 10, null, g, "gold").skin).toBe("gold");
    expect(certFacts(715093, 10, null, g, "acrylic").skin).toBeUndefined();
  });
});
