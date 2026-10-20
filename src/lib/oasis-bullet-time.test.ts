import { describe, expect, it, beforeEach } from "vitest";
import { bulletTime, bulletFrame, BULLET_COOLDOWN, BULLET_DURATION, cueToBullet } from "./oasis-bullet-time";

describe("bullet time", () => {
  beforeEach(() => bulletTime.reset());
  it("respects cooldown between sweeps", () => {
    expect(bulletTime.trigger("board", 10, 0)).toBe(true);
    bulletTime.stop();
    expect(bulletTime.trigger("anomaly", 10 + BULLET_COOLDOWN - 1, 0)).toBe(false);
    expect(bulletTime.trigger("anomaly", 10 + BULLET_COOLDOWN, 0)).toBe(true);
  });
  it("finishes after its duration with FOV restored", () => {
    bulletTime.trigger("board", 0, 0);
    const f = bulletFrame(bulletTime.active()!, BULLET_DURATION, 1);
    expect(f.done).toBe(true);
    expect(f.fovScale).toBeCloseTo(1);
  });
  it("ignores landmark cues (they have their own flyby)", () => {
    expect(cueToBullet("landmark")).toBeNull();
    expect(cueToBullet("board")).toBe("board");
  });
});
