import { describe, expect, it } from "vitest";
import { INTERIOR_DOORS, doorInReach, doorSpot } from "./biternam-doors";
import { LANDMARKS, landmarkSolids } from "./world-landmarks";

describe("oasis interior doors", () => {
  it("has seven doors", () => expect(Object.keys(INTERIOR_DOORS)).toHaveLength(7));
  for (const id of Object.keys(INTERIOR_DOORS)) {
    it(`${id} door is reachable and outside every building`, () => {
      const d = doorSpot(id)!;
      expect(doorInReach(d.x, d.z)).toBe(id);
      for (const lm of LANDMARKS) for (const s of landmarkSolids(lm)) expect(Math.hypot(s.x - d.x, s.z - d.z)).toBeGreaterThan(s.radius);
    });
  }
});
