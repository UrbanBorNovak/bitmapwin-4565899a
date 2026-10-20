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
