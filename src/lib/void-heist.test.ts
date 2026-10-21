import { describe, it, expect } from "vitest";
import { HEIST_STEPS, heldHeistItem } from "./void-heist";

describe("void heist chain", () => {
  it("visits all seven rooms and ends at the café trapdoor", () => {
    expect(new Set(HEIST_STEPS.map((s) => s.room)).size).toBe(7);
    expect(HEIST_STEPS.at(-1)!.room).toBe("cafe");
  });
  it("each step needs exactly what the previous step gave", () => {
    HEIST_STEPS.forEach((s, i) => expect(s.need).toBe(i === 0 ? null : HEIST_STEPS[i - 1]!.gives));
    expect(heldHeistItem(1)).toBe("golden-satoshi");
  });
});
