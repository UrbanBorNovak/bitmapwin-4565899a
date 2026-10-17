import { describe, expect, it } from "vitest";
import { loadBitmonFilters } from "./bitmon-filters";

describe("loadBitmonFilters", () => {
  it("restores saved creature and rarity", () =>
    expect(loadBitmonFilters(JSON.stringify({ rarity: "EPIC", species: "SAND BASILISK" }))).toEqual({ rarity: "EPIC", species: "SAND BASILISK" }));
  it("drops unknown values", () => expect(loadBitmonFilters(JSON.stringify({ rarity: "LEGEND", species: "DRAGON" }))).toEqual({ rarity: "ALL", species: "ALL" }));
  it("handles nothing saved", () => expect(loadBitmonFilters(null)).toEqual({ rarity: "ALL", species: "ALL" }));
});
