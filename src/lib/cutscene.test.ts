import { describe, expect, it } from "vitest";
import { cutsceneLength, frameAt, ROOM_CUTSCENES } from "./cutscene";

const c = { id: "t", frames: [{ focus: [50, 50] as [number, number], zoom: 1, ms: 1000 }, { focus: [50, 50] as [number, number], zoom: 2, ms: 500 }] };

describe("cutscene timing", () => {
  it("picks the playing frame and ends after the last", () => {
    expect(frameAt(c, 0)).toBe(0);
    expect(frameAt(c, 1200)).toBe(1);
    expect(frameAt(c, 1500)).toBe(-1);
    expect(cutsceneLength(c)).toBe(1500);
  });
  it("every room cutscene stays short (under 10s)", () => {
    for (const r of Object.values(ROOM_CUTSCENES)) for (const s of Object.values(r ?? {})) expect(cutsceneLength(s!)).toBeLessThan(10000);
  });
});
