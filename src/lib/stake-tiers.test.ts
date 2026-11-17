import { describe, it, expect } from "vitest";
import { stakeTier, tieredWeight, isMilestoneBlock, MAX_STAKE_WEIGHT } from "./stake-tiers";

const none = { patoshi: false, milestone: false, guardian: false, slab: false, forge: false };
describe("stake tiers", () => {
  it("plain BITMAP is weight ×1", () => expect(stakeTier(none).tier).toBe(1));
  it("Living Slab grade gives ×2", () => expect(stakeTier({ ...none, slab: true }).tier).toBe(2));
  it("Land Forge build gives ×2", () => expect(stakeTier({ ...none, forge: true }).tier).toBe(2));
  it("Patoshi gives ×3", () => expect(stakeTier({ ...none, patoshi: true, slab: true }).tier).toBe(3));
  it("inscribed Guardian gives ×3", () => expect(stakeTier({ ...none, guardian: true }).tier).toBe(3));
  it("halving block 840000 is a milestone", () => expect(isMilestoneBlock(840000)).toBe(true));
  it("weight 2 × tier 3 = 6", () => expect(tieredWeight(2, 3)).toBe(6));
  it("never exceeds the contract maximum", () => expect(tieredWeight(1461, 3)).toBe(MAX_STAKE_WEIGHT));
});
