import { describe, expect, it } from "vitest";
import { hairFor, wearById, wornFrom } from "@/lib/launch-seats";

describe("club hair", () => {
  it("no BITMAP is shaved", () => expect(hairFor(null)).toBe("shaved"));
  it("SUB 1K gets the golden crest", () => expect(hairFor(999)).toBe("genesis-crown"));
  it("SUB 10K gets the mullet", () => expect(hairFor(1000)).toBe("satoshi-mullet"));
  it("SUB 100K gets spikes", () => expect(hairFor(99_999)).toBe("pizza-spikes"));
  it("SUB 1M gets the crop", () => expect(hairFor(840_000)).toBe("halving-crop"));
});
describe("wardrobe", () => {
  it("block crown costs 500 BIT", () => expect(wearById("crown")?.price).toBe(500));
  it("newest piece per slot is worn", () =>
    expect(wornFrom([{ slot: "hat", item: "beanie" }, { slot: "food", item: "pizza" }, { slot: "hat", item: "cowboy" }])).toEqual({ hat: "beanie", food: "pizza" }));
});
