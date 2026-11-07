import { describe, expect, it } from "vitest";
import { INTERIOR_DOORS, doorInReach, doorSpot } from "./biternam-doors";
import { LANDMARKS, landmarkSolids } from "./world-landmarks";

describe("oasis interior doors", () => {
  it("has ten doors, including Urban's Island", () => {
    expect(Object.keys(INTERIOR_DOORS)).toHaveLength(10);
    expect(INTERIOR_DOORS["torii"]?.to).toBe("/biternam/island");
  });
  for (const id of Object.keys(INTERIOR_DOORS)) {
    it(`${id} door is reachable and outside every building`, () => {
      const d = doorSpot(id)!;
      expect(doorInReach(d.x, d.z)).toBe(id);
      expect(d.z).toBeGreaterThan(0); // on walkable ground
      for (const lm of LANDMARKS) for (const s of landmarkSolids(lm)) expect(Math.hypot(s.x - d.x, s.z - d.z)).toBeGreaterThan(s.radius);
    });
  }
});
