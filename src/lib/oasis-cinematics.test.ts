import { describe, expect, it } from "vitest";
import { CINEMATIC_SHOTS, shotFrame, shotInReach } from "./oasis-cinematics";
import { LANDMARKS, landmarkSpot } from "./world-landmarks";

describe("oasis cinematics", () => {
  const tower = CINEMATIC_SHOTS.find((s) => s.id === "tower")!;
  const spot = landmarkSpot(LANDMARKS.find((l) => l.id === "tower")!);

  it("triggers near a landmark only once it is unseen", () => {
    expect(shotInReach(spot.x, spot.z, new Set())?.id).toBe("tower");
    expect(shotInReach(spot.x, spot.z, new Set(["tower"]))).toBeNull();
  });

  it("does not trigger far from every landmark", () => {
    expect(shotInReach(1e6, 1e6, new Set())).toBeNull();
  });

  it("is deterministic and never goes below ground", () => {
    const ground = () => 3;
    const a = shotFrame(tower, 2, ground);
    expect(shotFrame(tower, 2, ground)).toEqual(a);
    expect(a.position.y).toBeGreaterThan(3);
  });
});
