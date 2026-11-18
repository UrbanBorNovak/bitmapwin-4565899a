import { describe, expect, it } from "vitest";
import { approachPoint, cycleTarget, pickAt } from "./mmo-target";
import type { BeastEntity } from "./world-entities";

const beast = (id: number, x: number, z: number, extra: Partial<BeastEntity> = {}): BeastEntity => ({
  id, label: `b${id}`, hostile: true, hp: 10, maxHp: 10, x, z, bodyY: 0, bodyRadius: 1, xp: 1, hitAt: 0, deadUntil: 0, ...extra,
});

describe("mmo targeting", () => {
  it("picks the beast under the click and ignores dead ones", () => {
    const a = beast(1, 0, 0);
    const dead = beast(2, 0.5, 0, { deadUntil: 5, hp: 0 });
    expect(pickAt({ x: 0.4, z: 0 }, [dead, a])).toBe(a);
    expect(pickAt({ x: 5, z: 0 }, [a])).toBeNull();
  });
  it("TAB cycles nearest first and wraps", () => {
    const near = beast(1, 1, 0), far = beast(2, 5, 0), out = beast(3, 50, 0);
    const list = [far, out, near];
    expect(cycleTarget({ x: 0, z: 0 }, list, null, 10)).toBe(near);
    expect(cycleTarget({ x: 0, z: 0 }, list, near, 10)).toBe(far);
    expect(cycleTarget({ x: 0, z: 0 }, list, far, 10)).toBe(near);
  });
  it("approach stops inside reach", () => {
    const b = beast(1, 10, 0);
    const p = approachPoint({ x: 0, z: 0 }, b)!;
    expect(10 - p.x).toBeLessThan(2.5);
    expect(approachPoint({ x: 8, z: 0 }, b)).toBeNull();
  });
});
