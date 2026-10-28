import { describe, it, expect } from "vitest";
import { archetypeFor, botVoxels, checkBudget, planFees } from "./bot-build";

describe("bot build", () => {
  it("refuses a build whose fees exceed the bot's max fee", () => {
    expect(checkBudget({ total: 5_001 }, 50_000, 5_000)).toMatch(/limit/);
    expect(checkBudget({ total: 4_000 }, 50_000, 5_000)).toBeNull();
  });
  it("refuses when the balance can't cover fees plus postage", () => {
    expect(checkBudget({ total: 4_000 }, 4_500, 5_000)).toMatch(/Not enough/);
  });
  it("fees grow with fee rate", () => {
    expect(planFees(10_000, 1, 4).total).toBeGreaterThan(planFees(10_000, 1, 1).total);
  });
  it("tower prompts become a spire", () => {
    expect(archetypeFor("Cyberpunk Radio Tower")).toBe("spire");
  });
  it("parcel builds stay inside owned cells", () => {
    const cells: number[] = [];
    for (let x = 10; x <= 20; x++) for (let z = 10; z <= 20; z++) cells.push(x * 64 + z);
    const { blocks } = botVoxels(819245, "tower", { txCount: 3000, rect: { index: 3, x0: 10, z0: 10, x1: 20, z1: 20, cells } });
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((b) => cells.includes(b.dx * 64 + b.dz))).toBe(true);
  });
});
