import { describe, expect, it } from "vitest";
import type { TplBlock } from "./voxel-templates";
import { isLive, type AsmPlacement } from "./forge-assembly";
import { stampInto, cellKey } from "./forge-prefabs";

const piece: TplBlock[] = [{ dx: 0, dy: 0, dz: 0, k: "gold" }, { dx: 1, dy: 0, dz: 0, k: "gold" }] as TplBlock[];
function stamp(world: Map<string, any>) {
  const next = stampInto(world, piece, 5, 0, 5);
  const keys = [...next.keys()].filter((k) => !world.has(k));
  const p: AsmPlacement = { part: { id: "a".repeat(64) + "i0", x: 5, y: 0, z: 5, r: 0 }, keys, refs: keys.map((k) => next.get(k)!) };
  return { next, p };
}

describe("recursive piece placement", () => {
  it("is live right after placing", () => {
    const { next, p } = stamp(new Map());
    expect(isLive(p, next)).toBe(true);
  });
  it("undo then building blocks in the same spot does not bring it back", () => {
    const before = new Map();
    const { p } = stamp(before);
    const rebuilt = stampInto(before, piece, 5, 0, 5); // same cells, own blocks
    expect(isLive(p, before)).toBe(false);
    expect(isLive(p, rebuilt)).toBe(false);
  });
  it("clear then rebuilding in the same spot does not bring it back", () => {
    const { p } = stamp(new Map());
    const cleared = new Map();
    expect(isLive(p, cleared)).toBe(false);
    const w = new Map<string, TplBlock>([[cellKey(5, 0, 5), { dx: 5, dy: 0, dz: 5, k: "stone" } as TplBlock], [cellKey(6, 0, 5), { dx: 6, dy: 0, dz: 5, k: "stone" } as TplBlock]]);
    expect(isLive(p, w)).toBe(false);
  });
});
