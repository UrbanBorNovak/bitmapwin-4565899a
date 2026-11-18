import { describe, expect, it } from "vitest";
import { findByNames, findNpcByName, playerModelNames, type CatalogEntry } from "./l2-actor-models";

const cat = (...names: string[]): CatalogEntry[] => names.map((name, i) => ({ key: `p:${i}`, pkg: "p.ukx", exportIndex: i, name }));

describe("player model names", () => {
  it("human female mystic uses the Magic body", () => expect(playerModelNames(0, 1, 10)[0]).toBe("FMagic"));
  it("human male fighter", () => expect(playerModelNames(0, 0, 0)).toEqual(["MFighter"]));
  it("orc male mystic uses the Shaman body", () => expect(playerModelNames(3, 0, 49)[0]).toBe("MShaman"));
  it("dark elf female", () => expect(playerModelNames(2, 1, 31)).toEqual(["FDarkElf"]));
  it("unknown race gives nothing", () => expect(playerModelNames(9, 0, 0)).toEqual([]));
});

describe("matching", () => {
  it("prefers exact, accepts a suffixed variant, rejects a longer word", () => {
    expect(findByNames(cat("MFighterX", "MFighter_m000"), ["MFighter"])?.name).toBe("MFighter_m000");
    expect(findByNames(cat("MFighterX"), ["MFighter"])).toBeNull();
  });
  it("NPCs match only a whole name and never the placeholder", () => {
    expect(findNpcByName(cat("Gremlin"), "gremlin")?.name).toBe("Gremlin");
    expect(findNpcByName(cat("Gremlin"), "Gremlin King")).toBeNull();
    expect(findNpcByName(cat("NPC30001"), "NPC 30001")).toBeNull();
  });
});
