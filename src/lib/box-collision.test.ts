import { afterEach, describe, expect, it } from "vitest";
import { boxSurfaceAt, boxWallAt, clearSpotNear, setBoxes } from "./box-collision";

const STEP = 0.0145, BODY = 0.018;

describe("inscribed-world box collision", () => {
  afterEach(() => setBoxes("t", null));

  it("a stair rise of 0.0133 can be stepped onto", () => {
    setBoxes("t", [{ x0: 0, x1: 1, y0: 0, y1: 0.0133, z0: 0, z1: 1 }]);
    expect(boxSurfaceAt(0.5, 0.5, 0, STEP)).toBeCloseTo(0.0133);
    expect(boxWallAt(0.5, 0.5, 0, BODY, STEP)).toBe(false);
  });

  it("a tall pillar blocks the body", () => {
    setBoxes("t", [{ x0: 0, x1: 1, y0: 0, y1: 0.13, z0: 0, z1: 1 }]);
    expect(boxSurfaceAt(0.5, 0.5, 0, STEP)).toBeNull();
    expect(boxWallAt(0.5, 0.5, 0, BODY, STEP)).toBe(true);
  });
});

describe("pillar body width", () => {
  afterEach(() => setBoxes("p", null));
  it("a thin pillar blocks a body just beside it", () => {
    setBoxes("p", [{ x0: 0, x1: 0.026, y0: 0, y1: 0.13, z0: 0, z1: 0.026 }]);
    expect(boxWallAt(0.029, 0.013, 0, 0.018, 0.0145, 0.004)).toBe(true);
    expect(boxWallAt(0.035, 0.013, 0, 0.018, 0.0145, 0.004)).toBe(false);
  });
});

describe("clearSpotNear", () => {
  afterEach(() => setBoxes("s", null));

  it("keeps a spawn that is already clear", () => {
    setBoxes("s", [{ x0: 0, x1: 0.01, y0: 0, y1: 0.13, z0: 0, z1: 0.01 }]);
    expect(clearSpotNear(0.05, 0.05, 0, BODY, STEP, 0.004)).toEqual([0.05, 0.05]);
  });

  it("moves a spawn embedded in a solid model to the nearest free spot", () => {
    setBoxes("s", [{ x0: 0, x1: 0.02, y0: 0, y1: 0.13, z0: 0, z1: 0.02 }]);
    const spot = clearSpotNear(0.01, 0.01, 0, BODY, STEP, 0.004);
    expect(spot).not.toBeNull();
    const [cx, cz] = spot!;
    expect(boxWallAt(cx, cz, 0, BODY, STEP, 0.004)).toBe(false);
    expect(Math.hypot(cx - 0.01, cz - 0.01)).toBeLessThan(0.03);
  });

  it("returns null when everything nearby is solid", () => {
    setBoxes("s", [{ x0: -1, x1: 1, y0: 0, y1: 0.13, z0: -1, z1: 1 }]);
    expect(clearSpotNear(0, 0, 0, BODY, STEP, 0.004, 0.02)).toBeNull();
  });
});
