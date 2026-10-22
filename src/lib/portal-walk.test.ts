import { describe, expect, it } from "vitest";
import { actorPositionAt, TRANSITION_SECONDS } from "@/lib/toon-script";
import type { ToonActor } from "@/lib/toon-script";
const lead = { x: 0, z: 2.5, pose: "walk", to: { x: 0, z: -22 }, moveStart: 0.2, moveEnd: 3.6 } as unknown as ToonActor;
describe("portal walk", () => {
  it("lead is past the gate (z -16) before the iris starts closing", () => {
    expect(actorPositionAt(lead, 4 - TRANSITION_SECONDS, 4).z).toBeLessThan(-16);
  });
  it("lead is still walking when it reaches the gate", () => {
    let t = 0; while (actorPositionAt(lead, t, 4).z > -16) t += 0.01;
    expect(actorPositionAt(lead, t, 4).moving).toBe(true);
  });
});
