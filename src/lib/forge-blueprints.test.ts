import { describe, expect, it } from "vitest";
import { BLUEPRINTS, BLUEPRINT_EPOCH, blueprintBlocks, weekNumber, weeklyBlueprint } from "./forge-blueprints";
import { prefabById } from "./forge-prefabs";

describe("forge blueprints", () => {
  it("advances to a new blueprint every 7 days", () => {
    expect(weekNumber(BLUEPRINT_EPOCH)).toBe(1);
    expect(weeklyBlueprint(BLUEPRINT_EPOCH).id).not.toBe(weeklyBlueprint(BLUEPRINT_EPOCH + 7 * 864e5).id);
  });
  it("only uses existing pieces and fits the build limit", () => {
    for (const bp of BLUEPRINTS) {
      for (const s of bp.steps) for (const p of s.parts) expect(prefabById(p.p), `${bp.id}:${p.p}`).toBeTruthy();
      expect(blueprintBlocks(bp).length).toBeLessThanOrEqual(2400);
    }
  });
});
