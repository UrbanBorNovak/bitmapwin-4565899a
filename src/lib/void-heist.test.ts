import { describe, it, expect } from "vitest";
import { HEIST_STEPS, HEIST_BIT, HEIST_QUEST_ID, heistStepKey, heldHeistItem } from "./void-heist";

describe("void heist chain", () => {
  it("visits all seven rooms and ends at the café trapdoor", () => {
    expect(new Set(HEIST_STEPS.map((s) => s.room)).size).toBe(7);
    expect(HEIST_STEPS.at(-1)!.room).toBe("cafe");
  });
  it("each step needs exactly what the previous step gave", () => {
    HEIST_STEPS.forEach((s, i) => expect(s.need).toBe(i === 0 ? null : HEIST_STEPS[i - 1]!.gives));
    expect(heldHeistItem(1)).toBe("golden-satoshi");
  });
  it("pays a fixed 100 BIT under its own server quest id", () => {
    expect(HEIST_BIT).toBe(100);
    expect(HEIST_QUEST_ID).toBe("ch4");
  });
  it("every step has a unique server key", () => {
    expect(new Set(HEIST_STEPS.map(heistStepKey)).size).toBe(7);
  });
});
