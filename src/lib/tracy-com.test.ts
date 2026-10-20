import { describe, expect, it } from "vitest";
import { SECTOR_09_BRIEFING as S, advance, nodeById, typedLength, validateScript } from "./tracy-com";

describe("tracy-com", () => {
  it("briefing script is valid", () => expect(validateScript(S)).toEqual([]));
  it("choice node waits until a choice is made", () => {
    const brief = nodeById(S, "brief")!;
    expect(advance(S, brief)?.id).toBe("brief");
    expect(advance(S, brief, 2)?.id).toBe("leave");
  });
  it("final node ends the call", () => expect(advance(S, nodeById(S, "go")!)).toBeNull());
  it("typing reveals 42 chars per second, clamped", () => {
    expect(typedLength("x".repeat(100), 1000)).toBe(42);
    expect(typedLength("abc", 5000)).toBe(3);
  });
  it("broken references are reported", () => {
    expect(validateScript({ id: "x", title: "", start: "a", nodes: [{ id: "a", speaker: "", text: "", next: "zz" }] })).toHaveLength(1);
  });
});

import { cueScript, shouldSpeak } from "./tracy-com";
describe("tracy oasis cues", () => {
  it("speaks first time, then waits 45s per subject", () => {
    expect(shouldSpeak(undefined, 0)).toBe(true);
    expect(shouldSpeak(1000, 40_000)).toBe(false);
    expect(shouldSpeak(1000, 46_000)).toBe(true);
  });
  it("cue scripts are valid one-line calls", () => {
    const s = cueScript({ kind: "sealed", title: "X", reason: "no-pass" });
    expect(validateScript(s)).toEqual([]);
    expect(cueScript({ kind: "board", rideId: "tank", label: "TANK" }).nodes[0].text).toMatch(/tank/i);
  });
});
