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
import { footprintsFor, ROOMS } from "@/components/toon/BiternamRooms";
describe("chapter marks are clear in every room", () => {
  it("lead walk, co-stars and finale spots never start inside furniture", () => {
    for (const s of ["cafe", "batcave", "vault", "chinatown", ...Object.keys(ROOMS).map((r) => `b-${r}`)]) {
      const f = footprintsFor(s);
      for (let i = 0; i <= 20; i++) expect(overlaps(-5.5 + 2.5 * (i / 20), 2.4 - 2.4 * (i / 20), ACTOR_R, [], f), s).toBe(false);
      for (const [x, z] of [[3, 0], [0, 0], [5, 2]] as const) expect(overlaps(x, z, ACTOR_R, [], f), s).toBe(false);
    }
  });
});
