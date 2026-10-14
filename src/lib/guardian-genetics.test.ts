import { describe, expect, it } from "vitest";
import { breedPet, blendHue, PET_SERVICE_FEE, type PetParent } from "./guardian-genetics";
import type { OnchainG } from "./onchain-guardian";

const g = (o: Partial<OnchainG>): OnchainG => ({ h: 1, sh: "quadruped", ra: "COMMON", body: "hsl(10,62%,46%)", accent: "hsl(200,88%,58%)", seg: 4, bulk: 1, horn: 0, wing: false, spine: false, pat: false, gait: 1, ...o });
const sire: PetParent = { inscriptionId: "aai0", height: 100, genome: g({ wing: true, ra: "EPIC" }) };
const dam: PetParent = { inscriptionId: "bbi0", height: 200, genome: g({ sh: "avian", wing: true, ra: "RARE", horn: 2 }) };

describe("guardian breeding", () => {
  it("service fee is 546 sats", () => expect(PET_SERVICE_FEE).toBe(546));
  it("same parents always hatch the same pet", () => expect(breedPet(sire, dam)).toEqual(breedPet(sire, dam)));
  it("refuses self-breeding", () => expect(() => breedPet(sire, sire)).toThrow());
  it("gen 0 parents hatch gen 1", () => expect(breedPet(sire, dam).gen).toBe(1));
  it("blends hues along the short arc", () => expect(blendHue(350, 10, 0.5)).toBe(0));
  it("two winged parents pass wings in nearly all pairs", () => {
    let w = 0;
    for (let i = 0; i < 200; i++) if (breedPet({ ...sire, inscriptionId: `s${i}i0` }, dam).wing) w++;
    expect(w).toBeGreaterThan(170);
  });
});
