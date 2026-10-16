import { describe, expect, it } from "vitest";
import { confirmedRarity, verifyBitmon } from "./bitmon-verify";

const dna = { rarity: "RARE" as const, species: "IRON GOLEM" as const };

describe("verifyBitmon", () => {
  it("confirms when chain DNA matches the stored record", () => {
    expect(verifyBitmon({ inscribed: true, dna, dnaState: "ok", stored: { rarity: "RARE", species: "IRON GOLEM" } }).status).toBe("verified");
  });
  it("uses chain values and flags a mismatch when the stored record disagrees", () => {
    const c = verifyBitmon({ inscribed: true, dna, dnaState: "ok", stored: { rarity: "EPIC", species: "SAND BASILISK" } });
    expect(c.status).toBe("mismatch");
    expect(confirmedRarity(c)).toBe("RARE");
  });
  it("stays unverified when the block cannot be read", () => {
    const c = verifyBitmon({ inscribed: true, dna: null, dnaState: "error", stored: { rarity: "EPIC", species: "SAND BASILISK" } });
    expect(c.status).toBe("unverified");
    expect(confirmedRarity(c)).toBeNull();
  });
  it("stays unverified without an on-chain inscription even if a record exists", () => {
    expect(verifyBitmon({ inscribed: false, dna, dnaState: "ok", stored: { rarity: "RARE", species: "IRON GOLEM" } }).status).toBe("unverified");
  });
});
