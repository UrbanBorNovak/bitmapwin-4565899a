import { describe, expect, it } from "vitest";
import { ACTOR_R, overlaps, separate, SET_FOOTPRINTS } from "./toon-collide";

describe("toon collisions", () => {
  it("two characters on the same spot end up not overlapping", () => {
    const [x, z] = separate(0, 0, ACTOR_R, [{ x: 0, z: 0, r: ACTOR_R }], []);
    expect(overlaps(x, z, ACTOR_R, [{ x: 0, z: 0, r: ACTOR_R }], [])).toBe(false);
  });
  it("a character inside the café bar is pushed out of it", () => {
    const [x, z] = separate(5, -18, ACTOR_R, [], SET_FOOTPRINTS["cafe"]!);
    expect(overlaps(x, z, ACTOR_R, [], SET_FOOTPRINTS["cafe"]!)).toBe(false);
  });
  it("a character in free space is not moved", () => {
    expect(separate(0, 5, ACTOR_R, [{ x: 20, z: 5, r: ACTOR_R }], SET_FOOTPRINTS["cafe"]!)).toEqual([0, 5]);
  });
});
