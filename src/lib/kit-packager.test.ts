import { describe, expect, it } from "vitest";
import { KIT_PUBLISH_SATS, sliceIntoSteps, tagToBehavior } from "./kit-packager";

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
  it("a tagged bag moves around its own base centre", () => {
    const s = sliceIntoSteps(blocks, 4);
    const b = tagToBehavior({ card: "sentry_turret", step: 3 }, s)!;
    expect(b.steps).toEqual([3]);
    expect(b.pivot[1]).toBe(s[3]!.blocks[0]!.dy);
  });
  it("tags on a missing bag are ignored", () => expect(tagToBehavior({ card: "beacon_pulse", step: 9 }, sliceIntoSteps(blocks, 2))).toBeNull());
});
