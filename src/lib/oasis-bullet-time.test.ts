import { describe, expect, it, beforeEach } from "vitest";
import { bulletTime, bulletFrame, BULLET_COOLDOWN, BULLET_DURATION, cueToBullet, stepBulletCam, type BulletEvent } from "./oasis-bullet-time";

const step = (pending: BulletEvent | null, now: number, extra: Partial<Parameters<typeof stepBulletCam>[0]> = {}) =>
  stepBulletCam({ pending, now, mode: "third", blocked: false, yaw: 0, unit: 1, ...extra });

describe("bullet time", () => {
  beforeEach(() => bulletTime.reset());

  for (const ev of ["board", "anomaly", "sealed", "hard-landing"] as const) {
    it(`${ev} starts a sweep and hands control back after ${BULLET_DURATION}s`, () => {
      expect(step(ev, 100)).not.toBeNull();
      expect(step(null, 101)).not.toBeNull();
      expect(step(null, 100 + BULLET_DURATION)).toBeNull();
      expect(bulletTime.active()).toBeNull();
    });
  }

  it("a skip stops the sweep and normal camera resumes next frame", () => {
    step("board", 0);
    bulletTime.stop();
    expect(step(null, 0.5)).toBeNull();
  });

  it("respects the 25s cooldown between sweeps", () => {
    step("board", 10);
    bulletTime.stop();
    expect(step("anomaly", 10 + BULLET_COOLDOWN - 1)).toBeNull();
    expect(step("anomaly", 10 + BULLET_COOLDOWN)).not.toBeNull();
  });

  it("never plays in first person, 2D view, or during a landmark flyby", () => {
    expect(step("board", 0, { mode: "first" })).toBeNull();
    expect(step("board", 0, { mode: "topdown" })).toBeNull();
    expect(step("board", 0, { blocked: true })).toBeNull();
    expect(bulletTime.active()).toBeNull();
  });

  it("finishes with FOV restored", () => {
    bulletTime.trigger("board", 0, 0);
    const f = bulletFrame(bulletTime.active()!, BULLET_DURATION, 1);
    expect(f.done).toBe(true);
    expect(f.fovScale).toBeCloseTo(1);
  });

  it("ignores landmark cues (they have their own flyby)", () => {
    expect(cueToBullet("landmark")).toBeNull();
    expect(cueToBullet("sealed")).toBe("sealed");
  });
});
