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
describe("room arrival", () => {
  it("lead is still striding into the room at the start of the opening shot", () => {
    const arrive = { x: -5.5, z: 2.4, pose: "talk", to: { x: -3, z: 0 }, moveStart: 0, moveEnd: 2.2 } as unknown as ToonActor;
    expect(actorPositionAt(arrive, 0.3, 9).moving).toBe(true);
    expect(actorPositionAt(arrive, 2.3, 9)).toMatchObject({ x: -3, z: 0, moving: false });
  });
});
describe("portal → room hand-off", () => {
  it("the lead's last portal step is its first room step once the room sits at its hand-off spot", () => {
    const off = [5.5, 0, -24.4];
    const end = actorPositionAt(lead, 4, 4);
    const roomStart = { x: -5.5, z: 2.4 };
    expect(roomStart.x + off[0]!).toBeCloseTo(end.x, 5);
    expect(roomStart.z + off[2]!).toBeCloseTo(end.z, 5);
  });
});
