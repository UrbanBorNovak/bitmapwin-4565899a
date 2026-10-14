import { afterEach, describe, expect, it } from "vitest";
import { resetTouchPad, stickIntent, takeTouchLook, takeTouchMovement, touchPad } from "./touch-input";

afterEach(resetTouchPad);

describe("Oasis touch input", () => {
  it("removes stick jitter and reaches full forward at the rim", () => {
    expect(stickIntent(0.05, -0.05)).toEqual({ forward: 0, turn: 0 });
    expect(stickIntent(0, -1)).toEqual({ forward: 1, turn: 0 });
    expect(Math.hypot(...Object.values(stickIntent(1, -1)))).toBeCloseTo(1);
  });
  it("eases movement independently of frame rate and stops on release", () => {
    touchPad.forward = 1;
    const first = takeTouchMovement(1 / 60).forward;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    takeTouchMovement(1 / 60);
    const twoFrames = takeTouchMovement(0).forward;
    resetTouchPad();
    touchPad.forward = 1;
    expect(takeTouchMovement(1 / 30).forward).toBeCloseTo(twoFrames);
    touchPad.forward = 0;
    expect(takeTouchMovement(1 / 60).forward).toBe(0);
  });
  it("smooths camera swipes without losing distance and clears pending input", () => {
    touchPad.lookX = 40;
    touchPad.lookY = -20;
    const first = takeTouchLook(1 / 60);
    expect(first.x).toBeGreaterThan(0);
    expect(first.x).toBeLessThan(40);
    let total = first.x;
    for (let i = 0; i < 120; i++) total += takeTouchLook(1 / 60).x;
    expect(total).toBeCloseTo(40);
    touchPad.lookX = 100;
    touchPad.throttle = 1;
    touchPad.fly = 1;
    resetTouchPad();
    expect(takeTouchLook(1 / 60)).toEqual({ x: 0, y: 0 });
    expect(touchPad.throttle).toBe(0);
    expect(touchPad.fly).toBe(0);
  });
});