import { describe, expect, it } from "vitest";
import { KIT_PUBLISH_SATS, sliceIntoSteps } from "./kit-packager";

const blocks = Array.from({ length: 100 }, (_, i) => ({ dx: i % 10, dy: Math.floor(i / 10), dz: 0, k: "stone" as const }));

describe("kit packager", () => {
  it("publishing costs 1,000 sats", () => expect(KIT_PUBLISH_SATS).toBe(1000));
  it("slices into the requested bags keeping every brick", () => {
    const s = sliceIntoSteps(blocks, 4);
    expect(s).toHaveLength(4);
    expect(s.reduce((n, x) => n + x.blocks.length, 0)).toBe(100);
  });
  it("builds bottom-up", () => {
    const s = sliceIntoSteps(blocks, 4);
    expect(s[0]!.blocks[0]!.dy).toBe(0);
    expect(s[3]!.blocks.at(-1)!.dy).toBe(9);
  });
});
